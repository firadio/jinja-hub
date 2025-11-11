# Python 版本

使用 Flask + Jinja2 模板引擎实现的多云平台管理系统。

## 特性

- 🐍 **原生 Jinja2** - 使用 Python 原生模板引擎
- 🚀 **快速开发** - Flask 简洁优雅
- 🤖 **AI 友好** - 易于集成各种 Python AI 库
- 📦 **丰富生态** - PyPI 海量第三方库

## 运行

```bash
# 安装依赖
pip install -r requirements.txt

# 开发模式
python app.py

# 生产环境 (使用 gunicorn)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8080 app:app

# 生产环境 (使用 uwsgi)
pip install uwsgi
uwsgi --http :8080 --wsgi-file app.py --callable app --processes 4
```

服务器启动在 `http://localhost:8080`

## 依赖

- Python 3.8+
- Flask 2.3+
- Jinja2 3.1+

## 虚拟环境 (推荐)

```bash
# 创建虚拟环境
python -m venv venv

# 激活 (Linux/Mac)
source venv/bin/activate

# 激活 (Windows)
venv\\Scripts\\activate

# 安装依赖
pip install -r requirements.txt
```

## Systemd 服务

```ini
[Unit]
Description=Cloud Platform Manager
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/cloud-manager/servers/python
Environment="PATH=/var/www/cloud-manager/servers/python/venv/bin"
ExecStart=/var/www/cloud-manager/servers/python/venv/bin/gunicorn -w 4 -b 0.0.0.0:8080 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

## Docker 部署

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY ../../sites /app/sites
EXPOSE 8080
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8080", "app:app"]
```

## 性能优化

- 使用 gunicorn 多进程
- 启用 Jinja2 模板缓存
- 使用 CDN 加速静态文件
