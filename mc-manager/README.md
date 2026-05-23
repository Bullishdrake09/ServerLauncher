# MC Manager - Minecraft Server Management Platform

A production-grade, self-hosted Minecraft server management platform built with Node.js, TypeScript, Fastify, and Next.js. Designed for Windows compatibility without Docker or Linux dependencies.

## Features

### MVP Features (Implemented)
- ✅ Create/Delete Minecraft servers
- ✅ Start/Stop/Restart server lifecycle management
- ✅ Real-time console with WebSocket streaming
- ✅ Command input to running servers
- ✅ Basic file manager (browse, read, edit, delete)
- ✅ Server configuration (RAM, auto-restart, JVM flags)
- ✅ Version selection (Vanilla, Paper, Fabric, Forge)
- ✅ SQLite database with PostgreSQL migration path
- ✅ JWT authentication with role-based access

### Architecture Highlights
- **Modular Service Layer**: Clean separation between API, services, and process management
- **Native Process Execution**: Servers run as native system processes using `child_process.spawn`
- **Filesystem Sandboxing**: Strict path validation prevents directory traversal attacks
- **Real-time Communication**: WebSocket gateway for live console streaming
- **Auto-restart Logic**: Configurable crash recovery with restart limits
- **Cross-platform**: Windows-first design, works on Linux/macOS too

## Project Structure

```
mc-manager/
├── backend/                 # Node.js + TypeScript + Fastify
│   └── src/
│       ├── api/            # REST API routes
│       ├── config/         # Configuration
│       ├── database/       # SQLite database service
│       ├── services/       # Business logic layer
│       │   ├── ServerManagerService.ts
│       │   ├── ProcessManager.ts
│       │   ├── FileManagerService.ts
│       │   └── VersionService.ts
│       └── websocket/      # WebSocket gateway
├── frontend/               # Next.js + React + TypeScript
│   └── src/
│       ├── app/           # Next.js App Router pages
│       ├── lib/           # API client, store, types
│       └── components/    # Reusable UI components
└── shared/                # Shared types
```

## Quick Start

### Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Java 17+** - Required for running Minecraft servers
   - Download from [Oracle](https://www.oracle.com/java/technologies/downloads/) or use [Adoptium](https://adoptium.net/)
3. **npm** or **pnpm** package manager

### Installation

```bash
# Clone the repository
cd mc-manager

# Install dependencies
npm install

# Or with pnpm (recommended)
pnpm install
```

### Running in Development

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend   # Backend on http://localhost:3001
npm run dev:frontend  # Frontend on http://localhost:3000
```

### Default Credentials

```
Username: admin
Password: admin123
```

⚠️ **Change the default password immediately!**

## Environment Variables

### Backend (.env or environment)

```bash
# Server
PORT=3001
HOST=0.0.0.0

# Paths
DATA_DIR=./data
SERVERS_DIR=./data/servers
DB_PATH=./data/mc-manager.db

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

# Logging
LOG_LEVEL=info
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user

### Servers
- `GET /api/servers` - List all servers
- `POST /api/servers` - Create new server
- `GET /api/servers/:id` - Get server details
- `PATCH /api/servers/:id` - Update server config
- `DELETE /api/servers/:id` - Delete server
- `POST /api/servers/:id/start` - Start server
- `POST /api/servers/:id/stop` - Stop server
- `POST /api/servers/:id/restart` - Restart server
- `POST /api/servers/:id/command` - Send console command
- `GET /api/servers/:id/logs` - Get log buffer

### Files
- `GET /api/servers/:id/files` - List files
- `GET /api/servers/:id/files/read` - Read file
- `POST /api/servers/:id/files/write` - Write file
- `DELETE /api/servers/:id/files` - Delete file
- `POST /api/servers/:id/files/directory` - Create directory

### Versions
- `GET /api/versions` - Get available Minecraft versions

### WebSocket
- `WS /ws/console` - Real-time console connection

## Building for Production

```bash
# Build both projects
npm run build

# Start production server
npm start
```

The backend will serve static files from the frontend build in production.

## Windows-Specific Notes

### Java Path Detection
The system automatically detects Java using:
1. `JAVA_HOME` environment variable
2. System PATH (`where java`)
3. Falls back to `java` command

### Running as a Service (Optional)

To run MC Manager as a Windows service, use [NSSM](https://nssm.cc/):

```powershell
# Download nssm.exe and add to PATH
nssm install MCManager "C:\path\to\node.exe" "C:\path\to\mc-manager\backend\dist\index.js"
nssm set MCManager DisplayName "MC Manager"
nssm set MCManager Description "Minecraft Server Management Platform"
nssm set MCManager StartType SERVICE_AUTO_START
nssm start MCManager
```

## Security Considerations

1. **Filesystem Sandboxing**: All file operations are validated against the server's root directory
2. **Path Traversal Prevention**: Normalized paths are checked to prevent `../` escapes
3. **JWT Authentication**: All API endpoints require valid authentication
4. **Role-based Access**: Admin vs User roles for permission control
5. **Input Validation**: All inputs are validated before processing

## Extensibility

### Adding New Server Types

Edit `backend/src/services/VersionService.ts`:

```typescript
async downloadServerJar(version, type, destination) {
  switch (type) {
    case 'spigot':
      return this.getSpigotServerUrl(version);
    // Add your custom type here
  }
}
```

### Database Migration to PostgreSQL

The database layer uses a simple interface. To migrate:

1. Replace `better-sqlite3` with `pg` in `DatabaseService.ts`
2. Convert SQL queries to parameterized PostgreSQL syntax
3. Update connection initialization

### Adding Backup Functionality

The `FileManagerService` includes backup methods:
- `createBackup()` - Zip world folder
- `extractBackup()` - Restore from zip

Connect these to the API and create a backup schedule using `node-cron`.

## Troubleshooting

### Server Won't Start
1. Check if Java is installed: `java -version`
2. Verify JAVA_HOME is set correctly
3. Check server logs in the console
4. Ensure port is not already in use

### WebSocket Connection Failed
1. Verify backend is running on port 3001
2. Check CORS settings allow frontend origin
3. Ensure token is being passed in WebSocket URL

### File Operations Fail
1. Check file permissions on the servers directory
2. Verify path doesn't contain invalid characters
3. Ensure file isn't locked by another process

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

---

Built with ❤️ for the Minecraft community.
