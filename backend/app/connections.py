import os
import ssl
from pathlib import Path
from urllib.parse import urlsplit

from opensearchpy._async.client import AsyncOpenSearch

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def project_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else PROJECT_ROOT / path


def postgres_connection_kwargs() -> dict[str, str]:
    password = os.getenv("PG_PASSWORD")
    return {"password": password} if password is not None else {}


def postgres_pool_limits(default_min: int = 1, default_max: int = 2) -> dict[str, int]:
    """Use conservative per-process pools; hosted databases often cap connections."""
    minimum = int(os.getenv("PG_POOL_MIN_SIZE", str(default_min)))
    maximum = int(os.getenv("PG_POOL_MAX_SIZE", str(default_max)))
    if minimum < 1 or maximum < minimum:
        raise ValueError("PG_POOL_MAX_SIZE must be >= PG_POOL_MIN_SIZE >= 1")
    return {"min_size": minimum, "max_size": maximum}


def create_opensearch_client() -> AsyncOpenSearch:
    url = os.getenv("OPENSEARCH_URL")
    if not url:
        raise RuntimeError("OPENSEARCH_URL is not configured")

    parsed_url = urlsplit(url)
    if not parsed_url.netloc:
        parsed_url = urlsplit(f"//{url}")
    is_https = parsed_url.scheme.lower() == "https"
    has_url_credentials = (
        parsed_url.username is not None or parsed_url.password is not None
    )
    if has_url_credentials and not is_https:
        raise RuntimeError("Authenticated OpenSearch connections require HTTPS")

    username = os.getenv("OPENSEARCH_USERNAME")
    password = os.getenv("OPENSEARCH_PASSWORD")
    if bool(username) != bool(password):
        raise RuntimeError(
            "OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD must be configured together"
        )

    verify_certs = os.getenv("OPENSEARCH_VERIFY_CERTS", "true").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }
    options = {
        "use_ssl": is_https,
        "verify_certs": verify_certs,
    }
    if username and password:
        if not is_https:
            raise RuntimeError("Authenticated OpenSearch connections require HTTPS")
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
    if protocol == "SSL":
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
    if protocol == "SASL_SSL":
        ca_path = project_path(os.getenv("KAFKA_CA", "certs/ca.pem"))
        if not ca_path.is_file():
            raise FileNotFoundError(f"Kafka CA file not found: {ca_path}")
        context = ssl.create_default_context(cafile=str(ca_path))
        sasl_mechanism = os.getenv("KAFKA_SASL_MECHANISM", "SCRAM-SHA-256")
        sasl_username = os.getenv("KAFKA_SASL_USERNAME")
        sasl_password = os.getenv("KAFKA_SASL_PASSWORD")
        if not sasl_username or not sasl_password:
            raise RuntimeError(
                "KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD required for SASL_SSL"
            )
        return {
            "bootstrap_servers": bootstrap_servers,
            "security_protocol": protocol,
            "ssl_context": context,
            "sasl_mechanism": sasl_mechanism,
            "sasl_plain_username": sasl_username,
            "sasl_plain_password": sasl_password,
        }
    raise ValueError(f"Unsupported KAFKA_SECURITY_PROTOCOL: {protocol}")
