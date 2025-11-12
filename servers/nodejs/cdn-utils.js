/**
 * CDN 工具 - 反向代理和本地缓存
 * 解决 jsdelivr 在中国无法访问的问题
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CDN 缓存目录
const CDN_CACHE_DIR = path.join(__dirname, '..', '..', 'sites', '_static', 'cdn');

// 可压缩的 MIME 类型
const compressibleTypes = new Set([
    'text/html',
    'text/css',
    'application/javascript',
    'application/json',
    'image/svg+xml',
    'text/plain',
]);

/**
 * 检查客户端是否支持 gzip
 */
function supportsGzip(req) {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    return acceptEncoding.includes('gzip');
}

/**
 * 检查内容类型是否可压缩
 */
function isCompressible(contentType) {
    return compressibleTypes.has(contentType.split(';')[0]);
}

/**
 * 发送响应（带 gzip 压缩支持）
 */
function sendCompressedResponse(res, req, contentType, buffer) {
    // 如果内容小于 1KB 或不可压缩，直接发送
    if (buffer.length < 1024 || !isCompressible(contentType) || !supportsGzip(req)) {
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=31536000',
        });
        res.end(buffer);
        return;
    }

    // 使用 gzip 压缩
    zlib.gzip(buffer, (err, compressed) => {
        if (err) {
            // 压缩失败，发送原始内容
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=31536000',
            });
            res.end(buffer);
            return;
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Encoding': 'gzip',
            'Content-Length': compressed.length,
            'Cache-Control': 'public, max-age=31536000',
        });
        res.end(compressed);
    });
}

// 确保缓存目录存在
function ensureCacheDir() {
    if (!fs.existsSync(CDN_CACHE_DIR)) {
        fs.mkdirSync(CDN_CACHE_DIR, { recursive: true });
    }
}

/**
 * 下载 CDN 文件到本地
 * @param {string} url - CDN 文件的完整 URL
 * @param {string} localPath - 本地保存路径（相对于 CDN_CACHE_DIR）
 * @returns {Promise<string>} - 本地文件路径
 */
function downloadCDNFile(url, localPath) {
    return new Promise((resolve, reject) => {
        ensureCacheDir();

        const fullLocalPath = path.join(CDN_CACHE_DIR, localPath);
        const localDir = path.dirname(fullLocalPath);

        // 确保目标目录存在
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        // 如果文件已存在，直接返回
        if (fs.existsSync(fullLocalPath)) {
            console.log(`CDN cache hit: ${localPath}`);
            resolve(fullLocalPath);
            return;
        }

        console.log(`Downloading CDN file: ${url}`);

        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(fullLocalPath);

        protocol.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`Downloaded: ${localPath}`);
                    resolve(fullLocalPath);
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // 处理重定向
                file.close();
                fs.unlinkSync(fullLocalPath);
                downloadCDNFile(response.headers.location, localPath)
                    .then(resolve)
                    .catch(reject);
            } else {
                file.close();
                fs.unlinkSync(fullLocalPath);
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(fullLocalPath)) {
                fs.unlinkSync(fullLocalPath);
            }
            reject(err);
        });
    });
}

/**
 * 处理 CDN 代理请求
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleCDNProxy(req, res) {
    // 解析 URL: /cdn/npm/daisyui@4.12.24/dist/full.min.css
    //         or: /cdn/tailwindcss/tailwind.js
    const urlPath = req.url.replace(/^\/cdn\//, '');

    if (!urlPath) {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }

    // 构建完整的 CDN URL
    let cdnUrl;
    if (urlPath.startsWith('tailwindcss/')) {
        // Tailwind CSS 使用特殊的 CDN
        cdnUrl = 'https://cdn.tailwindcss.com';
    } else {
        // 其他使用 jsDelivr CDN
        cdnUrl = `https://cdn.jsdelivr.net/${urlPath}`;
    }
    const localPath = urlPath.replace(/\//g, path.sep);

    // 确定 MIME 类型
    const ext = path.extname(urlPath);
    const mimeTypes = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.map': 'application/json',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.svg': 'image/svg+xml',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // 尝试从缓存提供文件
    const fullLocalPath = path.join(CDN_CACHE_DIR, localPath);
    if (fs.existsSync(fullLocalPath)) {
        fs.readFile(fullLocalPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Failed to read cache file');
                return;
            }
            sendCompressedResponse(res, req, contentType, data);
        });
        return;
    }

    // 下载并提供文件
    downloadCDNFile(cdnUrl, localPath)
        .then((localFile) => {
            fs.readFile(localFile, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Failed to read downloaded file');
                    return;
                }
                sendCompressedResponse(res, req, contentType, data);
            });
        })
        .catch((err) => {
            console.error(`CDN proxy error: ${err.message}`);
            res.writeHead(502);
            res.end('Failed to fetch from CDN');
        });
}

/**
 * 预下载常用 CDN 文件
 */
async function prewarmCache() {
    const commonFiles = [
        {
            url: 'https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.min.css',
            path: 'npm/daisyui@4.12.24/dist/full.min.css'
        },
        {
            url: 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js',
            path: 'npm/alpinejs@3.13.3/dist/cdn.min.js'
        },
        {
            url: 'https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js',
            path: 'npm/crypto-js@4.2.0/crypto-js.min.js'
        }
    ];

    console.log('Prewarming CDN cache...');
    for (const file of commonFiles) {
        try {
            await downloadCDNFile(file.url, file.path);
        } catch (err) {
            console.error(`Failed to prewarm ${file.path}: ${err.message}`);
        }
    }
    console.log('CDN cache prewarm complete');
}

module.exports = {
    handleCDNProxy,
    downloadCDNFile,
    prewarmCache,
};
