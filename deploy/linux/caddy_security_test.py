import http.client
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent


class CaddySecurityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which("caddy"):
            raise RuntimeError("caddy is required for routing security tests")
        cls.temp = tempfile.TemporaryDirectory()
        root = Path(cls.temp.name)
        media = root / "media"
        (media / "image-selection").mkdir(parents=True)
        (media / "image-selection" / "nonce").write_text("private image")
        (media / "image-selection-extra").mkdir()
        (media / "image-selection-extra" / "public.png").write_text("public image")
        (media / "public.png").write_text("public image")
        (media / "67e55044-10b1-426f-9247-bb680e5fe0c8").write_text("private image")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        config = (HERE / "Caddyfile").read_text().replace(":80 {", f"http://127.0.0.1:{cls.port} {{", 1)
        config = config.replace("/srv/kotobawork/data/media", str(media))
        config = config.replace("api-proxy:4001", "127.0.0.1:1").replace("admin:3001", "127.0.0.1:1").replace("web:3000", "127.0.0.1:1")
        config_path = root / "Caddyfile"
        config_path.write_text(config)
        cls.process = subprocess.Popen(["caddy", "run", "--config", str(config_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            if cls.process.poll() is not None:
                raise RuntimeError("Caddy failed to start")
            try:
                with socket.create_connection(("127.0.0.1", cls.port), timeout=0.1):
                    return
            except OSError:
                time.sleep(0.05)
        raise RuntimeError("Caddy did not start")

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        cls.temp.cleanup()

    def request(self, path):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        try:
            conn.request("GET", path)
            response = conn.getresponse()
            return response.status, response.read()
        finally:
            conn.close()

    def test_private_bucket_is_never_served(self):
        for path in (
            "/media/image-selection/nonce",
            "/media/67e55044-10b1-426f-9247-bb680e5fe0c8",
            "/media/image-selection",
            "/media/image-selection/",
            "/MEDIA/IMAGE-SELECTION/nonce",
            "/media/%69mage-selection/nonce",
            "/media/image%2dselection%2fnonce",
            "/media//image-selection/nonce",
            "/media/public/../image-selection/nonce",
            "/media/public/%2e%2e/image-selection/nonce",
            "/media/image-selection/../image-selection/nonce",
            "/media/public/../../media/image-selection/nonce",
            "/media%2fimage-selection%2fnonce",
            "/media/image-selection%2f.%2e%2fimage-selection%2fnonce",
        ):
            with self.subTest(path=path):
                status, body = self.request(path)
                self.assertNotEqual(status, 200, path)
                self.assertNotIn(b"private image", body, path)

    def test_public_media_is_still_served(self):
        self.assertEqual(self.request("/media/public.png"), (200, b"public image"))
        self.assertEqual(self.request("/media/image-selection-extra/public.png"), (200, b"public image"))

    def test_api_receives_image_provider_environment(self):
        compose = (HERE / "docker-compose.yml").read_text()
        api = compose.split("\n  api:\n", 1)[1].split("\n  web:\n", 1)[0]
        for key in ("IMAGE_SELECTION_SIGNING_KEY", "UNSPLASH_ACCESS_KEY", "PIXABAY_API_KEY", "PEXELS_API_KEY"):
            with self.subTest(key=key):
                self.assertIn(f'      {key}: "${{{key}:-}}"', api)


if __name__ == "__main__":
    unittest.main()
