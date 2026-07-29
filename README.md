# Persistent Playwright MCP

该项目通过 Docker Compose 运行一个可视、可持久化的 Playwright MCP 服务：

- noVNC：<http://127.0.0.1:6080/?autoconnect=true&resize=remote>
- MCP Streamable HTTP：<http://127.0.0.1:8931/mcp>
- Chromium 独立运行于 `browser` 容器；MCP 通过仅在 Compose 内网开放的 `browser.localhost` CDP 转发端口连接
- Chromium 使用系统 sandbox；`browser` 容器通过 `SYS_ADMIN` capability 获得创建 sandbox namespace 所需权限
- 浏览器配置、Cookie、登录状态和页面由 `browser-data` 命名卷及持续运行的浏览器进程保存
- MCP 使用共享浏览器上下文；HTTP 会话结束或 `mcp` 容器重启不会关闭 Chromium
- MCP 创建的截图、快照、控制台及网络日志等文件可在宿主机的 `./output` 目录访问

调用带文件路径的 MCP 工具时，请使用容器路径 `/data/output/<文件名>`；对应文件会出现在宿主机的 `./output/<文件名>`。

MCP 容器关闭了应用层 Host 检查，以兼容 `localhost`、`127.0.0.1` 和反向代理域名；默认的回环地址端口绑定仍阻止外部主机连接。若设置 `BIND_ADDRESS=0.0.0.0`，必须自行增加访问控制。

## 启动

需要 Docker Engine 和 Docker Compose v2。

```bash
docker compose up -d --build
docker compose ps
```

浏览器画面直接访问 <http://127.0.0.1:6080/?autoconnect=true&resize=remote>。MCP 客户端配置示例：

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://127.0.0.1:8931/mcp"
    }
  }
}
```

端口默认只监听本机，因为 noVNC 和 Playwright MCP 均未配置认证。确需从其他机器访问时：

```bash
cp .env.example .env
# 将 .env 中的 BIND_ADDRESS 改为 0.0.0.0，并在外层增加防火墙、反向代理和认证。
docker compose up -d
```

## 验证

服务启动后执行：

```bash
./scripts/test.sh
```

测试会确认 6080 提供 noVNC 页面且 WebSocket 能收到 x11vnc 的 RFB 握手、8931 接受 MCP 初始化与工具调用、截图写入宿主机 `output` 目录、不同 MCP 会话共享同一页面，并在重启 `mcp` 容器后再次读取页面标记。测试只重启 MCP，不重启浏览器。

查看日志：

```bash
docker compose logs -f browser mcp
```

## 数据与停止

普通停止不会删除浏览器数据：

```bash
docker compose down
```

再次启动时会恢复 Chromium 用户数据。`output` 是普通宿主机目录，`docker compose down --volumes` 不会删除其中的文件。若要清除浏览器资料，可显式执行：

```bash
docker compose down --volumes
```

浏览器进程本身在 `browser` 容器重建或停止时会结束；命名卷能保存用户资料，但未提交的临时页面状态不保证在浏览器进程重启后恢复。需求中的会话持久性由 MCP 与浏览器分离以及共享上下文保证。
