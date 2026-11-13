import os
import ssl
from pathlib import Path

from opensearchpy._async.client import AsyncOpenSearch

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def project_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else PROJECT_ROOT / path


def create_opensearch_client() -> AsyncOpenSearch:
    url = os.getenv("OPENSEARCH_URL")
    if not url:
        raise RuntimeError("OPENSEARCH_URL is not configured")

    username = os.getenv("OPENSEARCH_USERNAME")
    password = os.getenv("OPENSEARCH_PASSWORD")
    if bool(username) != bool(password):
        raise RuntimeError(
            "OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD must be configured together"
        )

    options = {
        "use_ssl": url.startswith("https://"),
        "verify_certs": True,
    }
    if username and password:
        return AsyncOpenSearch(url, **options, http_auth=(username, password))
    return AsyncOpenSearch(url, **options)


def kafka_client_options() -> dict:
    bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP")
    if not bootstrap_servers:
        raise RuntimeError("KAFKA_BOOTSTRAP is not configured")

    protocol = os.getenv("KAFKA_SECURITY_PROTOCOL", "SSL").upper()
    if protocol == "PLAINTEXT":
        return {
            "bootstrap_servers": bootstrap_servers,
            "security_protocol": protocol,
        }
    if protocol != "SSL":
        raise ValueError(f"Unsupported KAFKA_SECURITY_PROTOCOL: {protocol}")

    ca_path = project_path(os.getenv("KAFKA_CA", "certs/ca.pem"))
    cert_path = project_path(os.getenv("KAFKA_CERT", "certs/service.cert"))
    key_path = project_path(os.getenv("KAFKA_KEY", "certs/service.key"))
    for path in (ca_path, cert_path, key_path):
        if not path.is_file():
            raise FileNotFoundError(f"Kafka TLS file not found: {path}")

    context = ssl.create_default_context(cafile=str(ca_path))
    context.load_cert_chain(str(cert_path), str(key_path))
    return {
        "bootstrap_servers": bootstrap_servers,
        "security_protocol": protocol,
        "ssl_context": context,
    }
