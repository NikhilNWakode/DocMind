"""S3/MinIO object storage client."""

import boto3
import structlog
from botocore.exceptions import ClientError

from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

_s3_client = None


def get_s3_client():
    """Get or create the S3 client singleton."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name="us-east-1",
        )
        _ensure_bucket()
    return _s3_client


def _ensure_bucket() -> None:
    """Create the default bucket if it doesn't exist."""
    client = _s3_client
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        try:
            client.create_bucket(Bucket=settings.s3_bucket)
            logger.info("s3_bucket_created", bucket=settings.s3_bucket)
        except ClientError as e:
            logger.warning("s3_bucket_create_failed", error=str(e))


class StorageService:
    """Manages file storage in S3/MinIO."""

    def __init__(self):
        self.client = get_s3_client()
        self.bucket = settings.s3_bucket

    def upload_file(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload a file to S3. Returns the S3 key."""
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info("file_uploaded_to_s3", key=key, size=len(data))
        return key

    def download_file(self, key: str) -> bytes:
        """Download a file from S3."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        data = response["Body"].read()
        return data

    def delete_file(self, key: str) -> None:
        """Delete a file from S3."""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            logger.info("file_deleted_from_s3", key=key)
        except ClientError as e:
            logger.warning("s3_delete_failed", key=key, error=str(e))

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL."""
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def file_exists(self, key: str) -> bool:
        """Check if a file exists in S3."""
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False
