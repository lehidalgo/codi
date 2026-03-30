#!/usr/bin/env npx tsx
/**
 * Start one or more servers, wait for them to be ready, run a command, then clean up.
 *
 * Usage:
 *   # Single server
 *   npx tsx with-server.ts --server "npm run dev" --port 5173 -- node test.js
 *
 *   # Multiple servers
 *   npx tsx with-server.ts \
 *     --server "cd backend && node server.js" --port 3000 \
 *     --server "cd frontend && npm run dev" --port 5173 \
 *     -- node test.js
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";

function isServerReady(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      const socket = createConnection({ host: "localhost", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        setTimeout(attempt, 500);
      });
      socket.setTimeout(1000, () => {
        socket.destroy();
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

interface ServerConfig {
  cmd: string;
  port: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments manually (--server, --port, --timeout, then -- command)
  const servers: ServerConfig[] = [];
  let timeout = 30;
  let commandStart = -1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--") {
      commandStart = i + 1;
      break;
    }
    if (args[i] === "--server" && i + 1 < args.length) {
      const cmd = args[++i]!;
      // Expect --port next or find the matching --port
      servers.push({ cmd, port: 0 });
    } else if (args[i] === "--port" && i + 1 < args.length) {
      const port = parseInt(args[++i]!, 10);
      const last = servers[servers.length - 1];
      if (last && last.port === 0) last.port = port;
    } else if (args[i] === "--timeout" && i + 1 < args.length) {
      timeout = parseInt(args[++i]!, 10);
    }
  }

  const command = commandStart >= 0 ? args.slice(commandStart) : [];

  if (servers.length === 0 || command.length === 0) {
    console.error(
      "Usage: npx tsx with-server.ts --server <cmd> --port <port> [--timeout <sec>] -- <command...>",
    );
    process.exit(1);
  }

  if (servers.some((s) => s.port === 0)) {
    console.error("Error: Number of --server and --port arguments must match");
    process.exit(1);
  }

  const processes: ChildProcess[] = [];

  const cleanup = () => {
    console.log(`\nStopping ${processes.length} server(s)...`);
    for (let i = 0; i < processes.length; i++) {
      try {
        processes[i]!.kill("SIGTERM");
        console.log(`Server ${i + 1} stopped`);
      } catch {
        /* already dead */
      }
    }
    console.log("All servers stopped");
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(1);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(1);
  });

  try {
    // Start all servers
    for (let i = 0; i < servers.length; i++) {
      const server = servers[i]!;
      console.log(`Starting server ${i + 1}/${servers.length}: ${server.cmd}`);

      const proc = spawn(server.cmd, [], {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      processes.push(proc);

      console.log(`Waiting for server on port ${server.port}...`);
      const ready = await isServerReady(server.port, timeout * 1000);
      if (!ready) {
        throw new Error(
          `Server failed to start on port ${server.port} within ${timeout}s`,
        );
      }
      console.log(`Server ready on port ${server.port}`);
    }

    console.log(`\nAll ${servers.length} server(s) ready`);
    console.log(`Running: ${command.join(" ")}\n`);

    // Run the command
    const result = spawn(command[0]!, command.slice(1), {
      stdio: "inherit",
      shell: true,
    });

    const exitCode = await new Promise<number>((resolve) => {
      result.on("close", (code) => resolve(code ?? 1));
    });

    cleanup();
    process.exit(exitCode);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    cleanup();
    process.exit(1);
  }
}

main();
