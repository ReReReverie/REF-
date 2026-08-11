import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const npmCommand = process.platform === "win32" ? (process.env.npm_execpath ?? "npm.cmd") : "npm";
const npmPrefix = npmCommand.toLowerCase().endsWith(".js") ? [npmCommand] : [];
const npmExecutable = npmPrefix.length > 0 ? process.execPath : npmCommand;
const commonEnvironment = {
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
  GOOGLE_SITE_VERIFICATION: "",
  VERCEL_URL: "",
  VERCEL_PROJECT_PRODUCTION_URL: "",
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not determine a free test port.")));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function runCommand(command, args, environment, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...environment },
      stdio: options.stdio ?? "inherit",
      shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}\n${stdout}${stderr}`,
        ),
      );
    });
  });
}

function startNext(mode, port, environment) {
  const child = spawn(process.execPath, [nextCli, mode, "--port", String(port)], {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  return { child, getOutput: () => output };
}

async function waitForServer(server, baseUrl) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.child.exitCode !== null) {
      throw new Error(`Next server exited before becoming ready.\n${server.getOutput()}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      // The server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for Next server at ${baseUrl}.\n${server.getOutput()}`);
}

async function stopNext(server) {
  if (!server || server.child.exitCode !== null) return;

  if (process.platform === "win32") {
    try {
      await runCommand("taskkill.exe", ["/PID", String(server.child.pid), "/T", "/F"], {}, { stdio: "ignore" });
    } catch {
      server.child.kill();
    }
  } else {
    server.child.kill("SIGTERM");
  }

  await Promise.race([once(server.child, "close"), delay(5000)]);
}

async function runNodeTests(testFiles, environment) {
  await runCommand(process.execPath, ["--test", ...testFiles], environment);
}

async function build(environment) {
  await runCommand(npmExecutable, [...npmPrefix, "run", "build"], environment);
}

async function runScenario({ deployment, mode, port, runLogicTests }) {
  const siteUrl = `http://127.0.0.1:${port}/`;
  const environment = {
    ...commonEnvironment,
    VERCEL_ENV: deployment,
    SITE_URL: siteUrl,
  };
  const server = startNext(mode, port, environment);

  try {
    await waitForServer(server, siteUrl);
    const testEnvironment = {
      ...environment,
      REF_TEST_BASE_URL: siteUrl,
      REF_TEST_CANONICAL: siteUrl,
      REF_TEST_DEPLOYMENT: deployment,
    };
    const testFiles = runLogicTests
      ? [
          "tests/referee-logic.test.mjs",
          "tests/analytics.test.mjs",
          "tests/production-http.test.mjs",
        ]
      : ["tests/production-http.test.mjs"];
    await runNodeTests(testFiles, testEnvironment);
  } finally {
    await stopNext(server);
  }
}

const productionPort = await getFreePort();
const previewPort = await getFreePort();
const developmentPort = await getFreePort();

try {
  const developmentEnvironment = {
    ...commonEnvironment,
    VERCEL_ENV: "development",
    SITE_URL: `http://127.0.0.1:${developmentPort}/`,
  };
  await build(developmentEnvironment);
  await runScenario({
    deployment: "development",
    mode: "start",
    port: developmentPort,
    runLogicTests: false,
  });

  const previewEnvironment = {
    ...commonEnvironment,
    VERCEL_ENV: "preview",
    SITE_URL: `http://127.0.0.1:${previewPort}/`,
  };
  await build(previewEnvironment);
  await runScenario({
    deployment: "preview",
    mode: "start",
    port: previewPort,
    runLogicTests: false,
  });

  const productionEnvironment = {
    ...commonEnvironment,
    VERCEL_ENV: "production",
    SITE_URL: `http://127.0.0.1:${productionPort}/`,
  };
  await build(productionEnvironment);
  await runScenario({
    deployment: "production",
    mode: "start",
    port: productionPort,
    runLogicTests: true,
  });
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}
