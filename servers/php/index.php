<?php
/**
 * 多云平台管理系统 - PHP 版本
 * 使用 Twig 模板引擎 (兼容 Jinja2/pongo2/Nunjucks)
 */

// 加载 Composer 自动加载器
require_once __DIR__ . '/vendor/autoload.php';

use Twig\Loader\FilesystemLoader;
use Twig\Environment;
use Twig\TwigFilter;

// 项目根目录 (servers/php 的上两级)
$rootPath = dirname(__DIR__, 2);

// 加载站点配置
$sitesConfigPath = $rootPath . '/sites/sites.json';
$sitesConfig = json_decode(file_get_contents($sitesConfigPath), true);

// 加载所有站点配置
$siteConfigs = [];

// 域名到站点的映射
$domainToSite = [];

/**
 * 获取站点路径
 */
function getSitePath($siteName) {
    global $rootPath;
    return $rootPath . '/sites/' . $siteName;
}

/**
 * 加载站点配置
 */
function loadSiteConfig($siteName) {
    $configPath = getSitePath($siteName) . '/config.json';
    if (!file_exists($configPath)) {
        return null;
    }
    return json_decode(file_get_contents($configPath), true);
}

// 加载所有启用的站点配置和域名映射
foreach ($sitesConfig['sites'] as $siteName => $siteInfo) {
    if ($siteInfo['enabled']) {
        $config = loadSiteConfig($siteName);
        if ($config) {
            $siteConfigs[$siteName] = $config;
        } else {
            error_log("Warning: Failed to load $siteName config");
        }

        // 构建域名映射
        if (isset($siteInfo['domains']) && is_array($siteInfo['domains'])) {
            foreach ($siteInfo['domains'] as $domain) {
                $domainToSite[$domain] = $siteName;
            }
        }
    }
}

// 加载自定义域名映射
if (isset($sitesConfig['domain_mapping'])) {
    foreach ($sitesConfig['domain_mapping'] as $domain => $siteName) {
        $domainToSite[$domain] = $siteName;
    }
}

/**
 * 渲染首页 (所有站点列表)
 */
function renderHomePage() {
    global $sitesConfig;

    $homeSite = $sitesConfig['home_site'] ?? '_home';
    $templateDir = getSitePath($homeSite) . '/templates';

    if (!is_dir($templateDir)) {
        http_response_code(404);
        echo 'Home site not found';
        exit;
    }

    $loader = new FilesystemLoader($templateDir);
    $twig = new Environment($loader, [
        'cache' => false,
        'autoescape' => 'html',
    ]);

    // 将 sites 转换为排序后的数组
    $sitesArray = [];
    foreach ($sitesConfig['sites'] as $name => $info) {
        $sitesArray[] = ['name' => $name, 'info' => $info];
    }

    usort($sitesArray, function($a, $b) {
        $orderA = $a['info']['order'] ?? 0;
        $orderB = $b['info']['order'] ?? 0;
        if ($orderA !== $orderB) {
            return $orderA - $orderB;
        }
        return strcmp($a['name'], $b['name']);
    });

    $platform = $sitesConfig['platform'] ?? ['name' => 'Jinja Hub', 'description' => '开放式前端开发平台'];

    try {
        echo $twig->render('index.html', [
            'platform' => $platform,
            'sites' => $sitesArray
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo 'Home render error: ' . htmlspecialchars($e->getMessage());
        error_log('Home render error: ' . $e->getMessage());
    }
}

/**
 * 渲染站点页面 (使用路径模式)
 */
function renderSitePage($siteName, $pageName) {
    renderSitePageWithBasePath($siteName, $pageName, '/' . $siteName);
}

/**
 * 渲染站点页面 (指定 base_path)
 */
function renderSitePageWithBasePath($siteName, $pageName, $basePath) {
    global $sitesConfig, $siteConfigs;

    if (!isset($sitesConfig['sites'][$siteName])) {
        http_response_code(404);
        echo 'Site not found';
        exit;
    }

    $siteInfo = $sitesConfig['sites'][$siteName];

    if (!$siteInfo['enabled']) {
        http_response_code(404);
        echo "站点 $siteName 尚未启用";
        exit;
    }

    if (!isset($siteConfigs[$siteName])) {
        http_response_code(404);
        echo "站点 $siteName 配置不存在";
        exit;
    }
    $config = $siteConfigs[$siteName];

    $templateDir = getSitePath($siteName) . '/templates';
    if (!is_dir($templateDir)) {
        http_response_code(404);
        echo "站点 $siteName 模板目录不存在";
        exit;
    }

    $loader = new FilesystemLoader($templateDir);
    $twig = new Environment($loader, [
        'cache' => false,
        'autoescape' => 'html',
    ]);

    $jsonFilter = new TwigFilter('json', function ($value) {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    });
    $twig->addFilter($jsonFilter);

    $pageConfig = null;
    $templatePath = null;

    foreach ($config['pages'] ?? [] as $key => $val) {
        if ($key === $pageName) {
            $pageConfig = $val;
            $templatePath = 'pages/' . $key . '.html';
            break;
        }
    }

    if (empty($templatePath)) {
        $templatePath = 'pages/' . $pageName . '.html';
    }

    $fullPath = $templateDir . '/' . $templatePath;
    if (!file_exists($fullPath)) {
        http_response_code(404);
        echo '模板不存在: ' . htmlspecialchars($templatePath);
        exit;
    }

    // 添加 base_path 到 config
    $config['base_path'] = $basePath;

    // 将 pages 转换为排序后的数组
    if (isset($config['pages'])) {
        $pagesArray = [];
        foreach ($config['pages'] as $key => $value) {
            $pagesArray[] = ['key' => $key, 'value' => $value];
        }

        usort($pagesArray, function($a, $b) {
            $orderA = $a['value']['order'] ?? 0;
            $orderB = $b['value']['order'] ?? 0;
            if ($orderA !== $orderB) {
                return $orderA - $orderB;
            }
            return strcmp($a['key'], $b['key']);
        });

        $config['pages_array'] = $pagesArray;
    }

    // 将 sites 转换为排序后的数组
    $allSitesArray = [];
    foreach ($sitesConfig['sites'] as $id => $info) {
        $allSitesArray[] = ['id' => $id, 'info' => $info];
    }

    usort($allSitesArray, function($a, $b) {
        $orderA = $a['info']['order'] ?? 0;
        $orderB = $b['info']['order'] ?? 0;
        if ($orderA !== $orderB) {
            return $orderA - $orderB;
        }
        return strcmp($a['id'], $b['id']);
    });

    try {
        echo $twig->render($templatePath, [
            'config' => $config,
            'page' => $pageConfig,
            'site' => $siteInfo,
            'site_name' => $siteName,
            'platform' => $sitesConfig['platform'] ?? ['name' => 'Jinja Hub', 'description' => '开放式前端开发平台'],
            'all_sites' => $allSitesArray,
            'base_path' => $basePath
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo 'Render error: ' . htmlspecialchars($e->getMessage());
        error_log('Render error: ' . $e->getMessage());
    }
}

/**
 * 处理域名直接访问站点的路由
 */
function handleDomainSiteRoute($siteName, $subPath) {
    global $sitesConfig;

    if (!isset($sitesConfig['sites'][$siteName])) {
        http_response_code(404);
        echo 'Site not found';
        exit;
    }

    $siteInfo = $sitesConfig['sites'][$siteName];

    if (!$siteInfo['enabled']) {
        http_response_code(404);
        echo "站点 $siteName 尚未启用";
        exit;
    }

    // 静态文件路由
    if (strpos($subPath, '/static/') === 0) {
        $filePath = getSitePath($siteName) . $subPath;
        if (file_exists($filePath) && is_file($filePath)) {
            $mimeTypes = [
                'css' => 'text/css',
                'js' => 'application/javascript',
                'json' => 'application/json',
                'png' => 'image/png',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'svg' => 'image/svg+xml',
            ];
            $ext = pathinfo($filePath, PATHINFO_EXTENSION);
            $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';
            header("Content-Type: $contentType");
            readfile($filePath);
            exit;
        }
        http_response_code(404);
        echo '404 Not Found';
        exit;
    }

    // API 路由
    if ($subPath === '/api/config') {
        global $siteConfigs;
        if (!isset($siteConfigs[$siteName])) {
            http_response_code(404);
            echo 'Config not found';
            exit;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($siteConfigs[$siteName], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // 页面路由
    if ($subPath === '' || $subPath === '/' || $subPath === '/index.html') {
        renderSitePageWithBasePath($siteName, 'login', '/');
        exit;
    }

    if (preg_match('/^\/([a-z_]+)\.html$/', $subPath, $matches)) {
        $pageName = $matches[1];
        renderSitePageWithBasePath($siteName, $pageName, '/');
        exit;
    }

    http_response_code(404);
    echo '404 Not Found';
    exit;
}

// 路由处理
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 检查是否通过域名访问
$host = $_SERVER['HTTP_HOST'];
if (strpos($host, ':') !== false) {
    $host = substr($host, 0, strpos($host, ':'));
}

// 检查域名映射
if (isset($domainToSite[$host])) {
    $siteName = $domainToSite[$host];
    handleDomainSiteRoute($siteName, $requestUri);
}

// 根路径 -> 平台首页
if ($requestUri === '/' || $requestUri === '') {
    renderHomePage();
    exit;
}

// 解析站点路由
if (preg_match('#^/([^/]+)(/(.*))?$#', $requestUri, $matches)) {
    $siteName = $matches[1];
    $subPath = $matches[3] ?? '';

    // 检查站点是否存在
    if (!isset($sitesConfig['sites'][$siteName])) {
        http_response_code(404);
        echo 'Site not found';
        exit;
    }

    // 静态文件路由
    if (strpos($subPath, 'static/') === 0) {
        $filePath = getSitePath($siteName) . '/' . $subPath;

        if (file_exists($filePath) && is_file($filePath)) {
            // 根据文件类型设置 Content-Type
            $mimeTypes = [
                'css' => 'text/css',
                'js' => 'application/javascript',
                'json' => 'application/json',
                'png' => 'image/png',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'svg' => 'image/svg+xml',
            ];
            $ext = pathinfo($filePath, PATHINFO_EXTENSION);
            $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

            header("Content-Type: $contentType");
            readfile($filePath);
            exit;
        }

        http_response_code(404);
        echo '404 Not Found';
        exit;
    }

    // API 路由
    if ($subPath === 'api/config') {
        if (!isset($siteConfigs[$siteName])) {
            http_response_code(404);
            echo 'Config not found';
            exit;
        }

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($siteConfigs[$siteName], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // 页面路由
    if ($subPath === '' || $subPath === 'index.html') {
        // 站点首页
        renderSitePage($siteName, 'login');
        exit;
    }

    // 匹配 *.html 页面
    if (preg_match('/^([a-z_]+)\.html$/', $subPath, $pageMatches)) {
        $pageName = $pageMatches[1];
        renderSitePage($siteName, $pageName);
        exit;
    }
}

// 404
http_response_code(404);
echo '404 Not Found';
