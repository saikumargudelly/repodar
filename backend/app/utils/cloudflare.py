import os
import logging
import httpx

logger = logging.getLogger(__name__)


async def purge_cloudflare_cache():
    """
    Purge Cloudflare Edge Cache.
    Supports both API Token and Global API Key authentication.
    """
    zone_id = os.getenv("CLOUDFLARE_ZONE_ID")
    api_token = os.getenv("CLOUDFLARE_API_TOKEN")
    api_key = os.getenv("CLOUDFLARE_API_KEY")
    email = os.getenv("CLOUDFLARE_EMAIL")

    if not zone_id:
        logger.info("[cloudflare] CLOUDFLARE_ZONE_ID not configured. Skipping CDN cache purge.")
        return

    headers = {
        "Content-Type": "application/json",
    }

    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"
    elif api_key and email:
        headers["X-Auth-Key"] = api_key
        headers["X-Auth-Email"] = email
    else:
        logger.warning(
            "[cloudflare] Neither CLOUDFLARE_API_TOKEN nor CLOUDFLARE_API_KEY + "
            "CLOUDFLARE_EMAIL configured. Skipping CDN cache purge."
        )
        return

    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
    data = {"purge_everything": True}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=data, timeout=10.0)
            if resp.status_code == 200:
                logger.info("[cloudflare] Edge Cache purged successfully.")
            else:
                logger.error(f"[cloudflare] Failed to purge Edge Cache: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"[cloudflare] Error purging Edge Cache: {e}")
