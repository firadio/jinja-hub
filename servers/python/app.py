"""
多云平台管理系统 - Python 版本
使用 Flask + Jinja2 模板引擎 (原生 Jinja2 支持)
"""

from flask import Flask, render_template, jsonify, abort, send_from_directory, request
import json
import os
import argparse
from pathlib import Path

app = Flask(__name__, static_folder=None, template_folder=None)

# 项目根目录 (servers/python 的上两级)
ROOT_PATH = Path(__file__).parent.parent.parent

# 加载站点配置
with open(ROOT_PATH / 'sites' / 'sites.json', 'r', encoding='utf-8') as f:
    sites_config = json.load(f)

# 域名到站点的映射
domain_to_site = {}

# 构建域名映射
for site_name, site_info in sites_config['sites'].items():
    if site_info.get('enabled'):
        if 'domains' in site_info and isinstance(site_info['domains'], list):
            for domain in site_info['domains']:
                domain_to_site[domain] = site_name

# 加载自定义域名映射
if 'domain_mapping' in sites_config:
    for domain, site_name in sites_config['domain_mapping'].items():
        domain_to_site[domain] = site_name


def get_site_path(site_name):
    """获取站点路径"""
    return ROOT_PATH / 'sites' / site_name


def load_site_config(site_name):
    """加载站点配置"""
    config_path = get_site_path(site_name) / 'config.json'
    if not config_path.exists():
        return None
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


# 注册自定义 filter: json
@app.template_filter('json')
def json_filter(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


@app.before_request
def handle_domain_mapping():
    """处理域名映射"""
    host = request.host
    if ':' in host:
        host = host.split(':')[0]

    if host in domain_to_site:
        site_name = domain_to_site[host]
        path = request.path

        # 检查站点是否存在和启用
        if site_name not in sites_config['sites'] or not sites_config['sites'][site_name].get('enabled'):
            abort(404)

        # 静态文件路由
        if path.startswith('/static/'):
            return site_static(site_name, path[8:])

        # API 路由
        if path == '/api/config':
            return site_api_config(site_name)

        # 页面路由
        if path == '/' or path == '' or path == '/index.html':
            return render_site_page_with_base_path(site_name, 'login', '/')

        # 匹配 *.html 页面
        if path.endswith('.html') and path.count('/') == 1:
            page_name = path[1:-5]
            return render_site_page_with_base_path(site_name, page_name, '/')


@app.route('/')
def index():
    """首页 - 显示所有站点列表"""
    return render_home_page()


@app.route('/<site_name>/')
@app.route('/<site_name>/index.html')
def site_index(site_name):
    """站点首页"""
    return render_site_page(site_name, 'login')


@app.route('/<site_name>/<page_name>.html')
def site_page(site_name, page_name):
    """站点页面"""
    return render_site_page(site_name, page_name)


@app.route('/<site_name>/api/config')
def site_api_config(site_name):
    """站点配置 API"""
    if site_name not in sites_config['sites']:
        abort(404)

    config = load_site_config(site_name)
    if not config:
        abort(404)

    return jsonify(config)


@app.route('/<site_name>/static/<path:filename>')
def site_static(site_name, filename):
    """站点静态文件"""
    static_dir = get_site_path(site_name) / 'static'
    if not static_dir.exists():
        abort(404)
    return send_from_directory(static_dir, filename)


def render_home_page():
    """渲染首页（所有站点列表）"""
    home_site = sites_config.get('home_site', '_home')
    home_template_dir = ROOT_PATH / 'sites' / home_site / 'templates'
    if not home_template_dir.exists():
        abort(500, "首页模板目录不存在")

    app.template_folder = str(home_template_dir)

    # 将 sites 转换为排序后的数组
    sites_array = []
    for name, info in sites_config['sites'].items():
        sites_array.append({'name': name, 'info': info})

    sites_array.sort(key=lambda x: (x['info'].get('order', 0), x['name']))

    platform = sites_config.get('platform', {'name': 'Jinja Hub', 'description': '开放式前端开发平台'})

    return render_template(
        'index.html',
        platform=platform,
        sites=sites_array
    )


def render_site_page(site_name, page_name):
    """渲染站点页面 (使用路径模式)"""
    return render_site_page_with_base_path(site_name, page_name, f'/{site_name}')


def render_site_page_with_base_path(site_name, page_name, base_path):
    """渲染站点页面 (指定 base_path)"""
    if site_name not in sites_config['sites']:
        abort(404)

    site_info = sites_config['sites'][site_name]

    if not site_info.get('enabled', False):
        abort(404, f"站点 {site_name} 尚未启用")

    config = load_site_config(site_name)
    if not config:
        abort(404, f"站点 {site_name} 配置不存在")

    template_dir = get_site_path(site_name) / 'templates'
    if not template_dir.exists():
        abort(404, f"站点 {site_name} 模板目录不存在")

    app.template_folder = str(template_dir)

    # 查找页面配置
    page_config = None
    template_path = None

    for key, val in config.get('pages', {}).items():
        if key == page_name:
            page_config = val
            template_path = f'pages/{key}.html'
            break

    if not template_path:
        template_path = f'pages/{page_name}.html'

    full_template_path = template_dir / template_path
    if not full_template_path.exists():
        abort(404, f"模板不存在: {template_path}")

    # 添加 base_path 到 config
    config['base_path'] = base_path

    # 将 pages 转换为排序后的数组
    if 'pages' in config:
        pages_array = []
        for key, value in config['pages'].items():
            pages_array.append({'key': key, 'value': value})

        pages_array.sort(key=lambda x: (x['value'].get('order', 0), x['key']))
        config['pages_array'] = pages_array

    # 将 sites 转换为排序后的数组
    all_sites_array = []
    for site_id, site_info_item in sites_config['sites'].items():
        all_sites_array.append({'id': site_id, 'info': site_info_item})

    all_sites_array.sort(key=lambda x: (x['info'].get('order', 0), x['id']))

    platform = sites_config.get('platform', {'name': 'Jinja Hub', 'description': '开放式前端开发平台'})

    return render_template(
        template_path,
        config=config,
        page=page_config,
        site=site_info,
        site_name=site_name,
        platform=platform,
        all_sites=all_sites_array,
        base_path=base_path
    )


if __name__ == '__main__':
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='Jinja Hub - Python Server')
    parser.add_argument('--addr', type=str, default=':8080', help='监听地址 (例如: :8080 或 127.0.0.1:8080)')
    args = parser.parse_args()

    # 解析监听地址
    addr = args.addr
    if addr.startswith(':'):
        host = '0.0.0.0'
        port = int(addr[1:])
    elif ':' in addr:
        parts = addr.split(':')
        host = parts[0] if parts[0] else '0.0.0.0'
        port = int(parts[1])
    else:
        host = '0.0.0.0'
        port = int(addr)

    platform_name = sites_config.get('platform', {}).get('name', 'Jinja Hub')
    print(f'{platform_name} starting on {addr}')
    print(f'Platform home: http://localhost:{port}/')
    print('\nEnabled sites:')
    for site_name, site_info in sites_config['sites'].items():
        if site_info.get('enabled'):
            print(f'  - {site_info["name"]}: http://localhost:{port}/{site_name}/')

    # 开发模式
    app.run(host=host, port=port, debug=True)
