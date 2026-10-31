import json
import os
import http.client
import socket
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
API = HERE.parents[1] / "apps" / "api-go"


class FrontendComposeTest(unittest.TestCase):
    def test_browser_api_uses_caddy_origin_at_build_and_runtime(self):
        result = subprocess.run(
            ["docker", "compose", "-f", str(HERE / "docker-compose.yml"), "config", "--format", "json"],
            check=True, capture_output=True, text=True,
        )
        services = json.loads(result.stdout)["services"]
        for name in ("web", "admin"):
            with self.subTest(service=name):
                self.assertEqual(services[name]["environment"]["NEXT_PUBLIC_API_URL"], "")
                self.assertEqual(services[name]["environment"]["API_URL"], "http://api:4001")
                self.assertEqual(services[name]["build"].get("args", {}).get("NEXT_PUBLIC_API_URL"), "")
        self.assertEqual(services["web"]["build"].get("dockerfile"), "apps/web/Dockerfile.staging")
        dockerfile = (HERE.parents[1] / "apps/web/Dockerfile.staging").read_text()
        self.assertIn("ARG NEXT_PUBLIC_API_URL=http://192.168.1.8:14001", dockerfile)
        self.assertIn("ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}", dockerfile)
        self.assertEqual(services["api"]["ports"][0]["host_ip"], "127.0.0.1")

    def test_cookie_security_follows_staging_scheme(self):
        command = ["docker", "compose", "-f", str(HERE / "docker-compose.yml"), "config", "--format", "json"]
        for value in ("false", "true"):
            env = {**os.environ, "COOKIE_SECURE": value}
            services = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, env=env).stdout)["services"]
            self.assertEqual(services["api"]["environment"]["COOKIE_SECURE"], value)

    def test_caddy_origin_is_trusted_and_can_be_configured_for_https(self):
        command = ["docker", "compose", "-f", str(HERE / "docker-compose.yml"), "config", "--format", "json"]
        env = {**os.environ, "CORS_ORIGINS": "http://192.168.1.8:18080,https://stage.example.test"}
        services = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, env=env).stdout)["services"]
        self.assertEqual(services["api"]["environment"]["CORS_ORIGINS"], env["CORS_ORIGINS"])
        env.pop("CORS_ORIGINS")
        services = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, env=env).stdout)["services"]
        self.assertIn("http://192.168.1.8:18080", services["api"]["environment"]["CORS_ORIGINS"].split(","))

    def test_caddy_forwards_post_to_real_csrf_guard(self):
        with tempfile.TemporaryDirectory(dir=API) as directory:
            root = Path(directory)
            source = root / "main.go"
            source.write_text('''package main
import ("net/http"; "os"; "strings"; "github.com/nihongo-bjt/api-go/internal/authn")
func main() {
 guard := authn.CSRFGuard(authn.CSRFConfig{TrustedOrigins: strings.Split(os.Getenv("CORS_ORIGINS"), ",")})
 http.ListenAndServe(os.Getenv("ADDR"), guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })))
}
''')
            # Read the module name from the checked-in go.mod instead of assuming a deployment path.
            module = (API / "go.mod").read_text().splitlines()[0].split()[1]
            source.write_text(source.read_text().replace("github.com/nihongo-bjt/api-go", module))
            binary = root / "api-test"
            subprocess.run(["go", "build", "-o", str(binary), str(source)], cwd=API, check=True, capture_output=True)
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                api_port = sock.getsockname()[1]
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                caddy_port = sock.getsockname()[1]
            origin = "http://192.168.1.8:18080"
            env = {**os.environ, "CORS_ORIGINS": f"{origin},https://stage.example.test"}
            command = ["docker", "compose", "-f", str(HERE / "docker-compose.yml"), "config", "--format", "json"]
            services = json.loads(subprocess.run(command, check=True, capture_output=True, text=True, env=env).stdout)["services"]
            env.update(ADDR=f"127.0.0.1:{api_port}", CORS_ORIGINS=services["api"]["environment"]["CORS_ORIGINS"])
            api = subprocess.Popen([str(binary)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            config = (HERE / "Caddyfile").read_text().replace(":80 {", f":{caddy_port} {{", 1).replace("api-proxy:4001", f"127.0.0.1:{api_port}")
            config_path = root / "Caddyfile"
            config_path.write_text(config)
            caddy = subprocess.Popen(["caddy", "run", "--config", str(config_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for port in (api_port, caddy_port):
                    for _ in range(100):
                        try:
                            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                                break
                        except OSError:
                            time.sleep(0.05)
                    else:
                        self.fail(f"service on port {port} did not start")
                for request_origin, expected in ((origin, 204), ("https://stage.example.test", 204), ("http://attacker.example", 403)):
                    with self.subTest(origin=request_origin):
                        conn = http.client.HTTPConnection("127.0.0.1", caddy_port, timeout=5)
                        try:
                            conn.request("POST", "/api/test", headers={"Host": "192.168.1.8:18080", "Origin": request_origin})
                            response = conn.getresponse()
                            response.read()
                            self.assertEqual(response.status, expected)
                        finally:
                            conn.close()
            finally:
                caddy.terminate()
                api.terminate()
                caddy.wait(timeout=5)
                api.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
