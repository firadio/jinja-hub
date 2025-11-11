/**
 * 多云平台管理系统 - Node.js 版本
 * 使用 Nunjucks 模板引擎 (兼容 Jinja2/Twig/pongo2)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

// 项目根目录 (servers/nodejs 的上两级)
const ROOT_PATH = path.join(__dirname, '..', '..');

// 加载站点配置
const sitesConfigPath = path.join(ROOT_PATH, 'sites', 'sites.json');
const sitesConfig = JSON.parse(fs.readFileSync(sitesConfigPath, 'utf-8'));

// 加载所有站点配置
const siteConfigs = {};

/**
 * 获取站点路径
 */
function getSitePath(siteName) {
    return path.join(ROOT_PATH, 'sites', siteName);
}

/**
 * 加载站点配置
 */
function loadSiteConfig(siteName) {
    const configPath = path.join(getSitePath(siteName), 'config.json');
    if (!fs.existsSync(configPath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// 域名到站点的映射
const domainToSite = {};

// 加载所有启用的站点配置
for (const [siteName, siteInfo] of Object.entries(sitesConfig.sites)) {
    if (siteInfo.enabled) {
        const config = loadSiteConfig(siteName);
        if (config) {
            siteConfigs[siteName] = config;
        } else {
            console.warn(`Warning: Failed to load ${siteName} config`);
        }

        // 构建域名映射
        if (siteInfo.domains && Array.isArray(siteInfo.domains)) {
            for (const domain of siteInfo.domains) {
                domainToSite[domain] = siteName;
            }
        }
    }
}

// 加载自定义域名映射
if (sitesConfig.domain_mapping) {
    for (const [domain, siteName] of Object.entries(sitesConfig.domain_mapping)) {
        domainToSite[domain] = siteName;
    }
}

// MIME 类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

/**
 * 处理域名直接访问站点的路由
 */
function handleDomainSiteRoute(req, res, siteName, pathname) {
    // 检查站点是否存在
    if (!sitesConfig.sites[siteName]) {
        res.writeHead(404);
        res.end('Site not found');
        return;
    }

    const siteInfo = sitesConfig.sites[siteName];

    // 检查站点是否启用
    if (!siteInfo.enabled) {
        res.writeHead(404);
        res.end(`站点 ${siteName} 尚未启用`);
        return;
    }

    // 静态文件路由
    if (pathname.startsWith('/static/')) {
        const filePath = path.join(getSitePath(siteName), pathname);

        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (err) {
                res.writeHead(404);
                res.end('404 Not Found');
                return;
            }

            const ext = path.extname(filePath);
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        });
        return;
    }

    // API 路由
    if (pathname === '/api/config') {
        const config = siteConfigs[siteName];
        if (!config) {
            res.writeHead(404);
            res.end('Config not found');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(config));
        return;
    }

    // 页面路由
    if (pathname === '' || pathname === '/' || pathname === '/index.html') {
        // 站点首页 - 使用域名模式，base_path 为 /
        renderSitePageWithBasePath(res, siteName, 'login', '/');
        return;
    }

    // 匹配 *.html 页面
    if (/^\/([a-z_]+)\.html$/.test(pathname)) {
        const pageName = pathname.slice(1, -5);  // 移除 / 和 .html
        renderSitePageWithBasePath(res, siteName, pageName, '/');
        return;
    }

    // 404
    res.writeHead(404);
    res.end('404 Not Found');
}

/**
 * 渲染站点页面（带基础路径）
 */
function renderSitePageWithBasePath(res, siteName, pageName, basePath) {
    // 检查站点是否存在
    if (!sitesConfig.sites[siteName]) {
        res.writeHead(404);
        res.end('Site not found');
        return;
    }

    const siteInfo = sitesConfig.sites[siteName];

    // 检查站点是否启用
    if (!siteInfo.enabled) {
        res.writeHead(404);
        res.end(`站点 ${siteName} 尚未启用`);
        return;
    }

    // 加载站点配置
    const config = siteConfigs[siteName];
    if (!config) {
        res.writeHead(404);
        res.end(`站点 ${siteName} 配置不存在`);
        return;
    }

    // 配置模板目录为当前站点的 templates 目录
    const templateDir = path.join(getSitePath(siteName), 'templates');
    if (!fs.existsSync(templateDir)) {
        res.writeHead(404);
        res.end(`站点 ${siteName} 模板目录不存在`);
        return;
    }

    // 创建站点专用的 Nunjucks 环境
    const env = nunjucks.configure(templateDir, {
        autoescape: true,  // 启用自动转义(沙盒模式)
        trimBlocks: true,
        lstripBlocks: true,
        noCache: true,  // 开发环境关闭缓存
    });

    // 注册自定义 filter: json
    env.addFilter('json', function(value) {
        return JSON.stringify(value);
    });

    // 查找页面配置
    let pageConfig = null;
    let templatePath = null;

    for (const [key, val] of Object.entries(config.pages || {})) {
        if (key === pageName) {
            pageConfig = val;
            templatePath = `pages/${key}.html`;
            break;
        }
    }

    // 如果找不到配置，使用默认路径
    if (!templatePath) {
        templatePath = `pages/${pageName}.html`;
    }

    // 检查模板文件是否存在
    const fullPath = path.join(templateDir, templatePath);
    if (!fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end(`模板不存在: ${templatePath}`);
        return;
    }

    try {
        const configWithBasePath = { ...config, base_path: basePath };

        // 将 pages 转换为排序后的数组
        if (configWithBasePath.pages) {
            const pagesArray = Object.entries(configWithBasePath.pages)
                .sort(([keyA, valA], [keyB, valB]) => {
                    const orderA = valA.order || 0;
                    const orderB = valB.order || 0;
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    return keyA.localeCompare(keyB);
                })
                .map(([key, value]) => ({ key, value }));
            configWithBasePath.pages_array = pagesArray;
        }

        // 将 sites 转换为排序后的数组
        const allSitesArray = Object.entries(sitesConfig.sites)
            .sort(([idA, infoA], [idB, infoB]) => {
                const orderA = infoA.order || 0;
                const orderB = infoB.order || 0;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return idA.localeCompare(idB);
            })
            .map(([id, info]) => ({ id, info }));

        const html = env.render(templatePath, {
            config: configWithBasePath,
            page: pageConfig,
            site: siteInfo,
            site_name: siteName,
            platform: sitesConfig.platform || { name: 'Jinja Hub', description: '开放式前端开发平台' },
            all_sites: allSitesArray,
            base_path: basePath
        });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    } catch (err) {
        console.error('Render error:', err);
        res.writeHead(500);
        res.end(`Render error: ${err.message}`);
    }
}

/**
 * 渲染站点页面 (使用路径模式)
 */
function renderSitePage(res, siteName, pageName) {
    renderSitePageWithBasePath(res, siteName, pageName, `/${siteName}`);
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // 检查是否通过域名访问
    let host = req.headers.host;
    // 移除端口号
    if (host.includes(':')) {
        host = host.split(':')[0];
    }

    // 检查域名映射
    if (domainToSite[host]) {
        const siteName = domainToSite[host];
        handleDomainSiteRoute(req, res, siteName, pathname);
        return;
    }

    // 根路径 -> 平台首页
    if (pathname === '/' || pathname === '') {
        const homeSite = sitesConfig.home_site || '_home';
        const templateDir = path.join(getSitePath(homeSite), 'templates');

        if (!fs.existsSync(templateDir)) {
            res.writeHead(404);
            res.end('Home site not found');
            return;
        }

        // 创建 Nunjucks 环境
        const env = nunjucks.configure(templateDir, {
            autoescape: true,
            trimBlocks: true,
            lstripBlocks: true,
            noCache: true,
        });

        try {
            // 将 sites 转换为排序后的数组
            const sitesArray = Object.entries(sitesConfig.sites)
                .sort(([nameA, infoA], [nameB, infoB]) => {
                    const orderA = infoA.order || 0;
                    const orderB = infoB.order || 0;
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    return nameA.localeCompare(nameB);
                })
                .map(([name, info]) => ({ name, info }));

            const html = env.render('index.html', {
                platform: sitesConfig.platform || { name: 'Jinja Hub', description: '开放式前端开发平台' },
                sites: sitesArray
            });

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } catch (err) {
            console.error('Render error:', err);
            res.writeHead(500);
            res.end(`Render error: ${err.message}`);
        }
        return;
    }

    // 解析站点路由
    const match = pathname.match(/^\/([^\/]+)(\/(.*))?$/);
    if (!match) {
        res.writeHead(404);
        res.end('404 Not Found');
        return;
    }

    const siteName = match[1];
    const subPath = match[3] || '';

    // 检查站点是否存在
    if (!sitesConfig.sites[siteName]) {
        res.writeHead(404);
        res.end('Site not found');
        return;
    }

    // 静态文件路由
    if (subPath.startsWith('static/')) {
        const filePath = path.join(getSitePath(siteName), subPath);

        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (err) {
                res.writeHead(404);
                res.end('404 Not Found');
                return;
            }

            const ext = path.extname(filePath);
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        });
        return;
    }

    // API 路由
    if (subPath === 'api/config') {
        const config = siteConfigs[siteName];
        if (!config) {
            res.writeHead(404);
            res.end('Config not found');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(config));
        return;
    }

    // 页面路由
    if (subPath === '' || subPath === 'index.html') {
        // 站点首页
        renderSitePage(res, siteName, 'login');
        return;
    }

    // 匹配 *.html 页面
    if (/^([a-z_]+)\.html$/.test(subPath)) {
        const pageName = subPath.slice(0, -5);  // 移除 .html
        renderSitePage(res, siteName, pageName);
        return;
    }

    // 404
    res.writeHead(404);
    res.end('404 Not Found');
});

// 解析命令行参数
const args = process.argv.slice(2);
let addr = ':8080';  // 默认监听地址

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--addr' && i + 1 < args.length) {
        addr = args[i + 1];
        break;
    }
}

// 解析监听地址
let host = '';
let port = 8080;

if (addr.startsWith(':')) {
    // 格式: :8080
    port = parseInt(addr.slice(1));
} else if (addr.includes(':')) {
    // 格式: 127.0.0.1:8080
    const parts = addr.split(':');
    host = parts[0];
    port = parseInt(parts[1]);
} else {
    // 格式: 8080
    port = parseInt(addr);
}

// 启动服务器
server.listen(port, host, () => {
    const platform = sitesConfig.platform || { name: 'Jinja Hub' };
    console.log(`${platform.name} starting on ${addr}`);
    console.log(`Platform home: http://localhost:${port}/`);

    // 列出所有启用的站点
    console.log('\nEnabled sites:');
    for (const [siteName, siteInfo] of Object.entries(sitesConfig.sites)) {
        if (siteInfo.enabled) {
            console.log(`  - ${siteInfo.name}: http://localhost:${port}/${siteName}/`);
        }
    }
});
