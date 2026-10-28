from __future__ import annotations

from pathlib import Path
from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.storage import Store
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

from .const import DOMAIN, STORAGE_VERSION, STORAGE_KEY, PANEL_PATH

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load()
    if not isinstance(data, dict) or not isinstance(data.get("bookmarks"), list):
        data = {"bookmarks": []}

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["store"] = store
    hass.data[DOMAIN]["data"] = data

    async def get_bookmarks(call):
        # Home Assistant service calls don't provide a stable generic return payload
        # for this use case; the frontend reads the stored list through a websocket command.
        return

    async def save_bookmarks(call):
        bookmarks = call.data.get("bookmarks", [])
        if not isinstance(bookmarks, list) or len(bookmarks) > 500:
            raise vol.Invalid("Ogiltig bokmärkeslista")
        cleaned = []
        for item in bookmarks:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()[:100]
            url = str(item.get("url", "")).strip()[:2048]
            icon = str(item.get("icon", "mdi:bookmark"))[:80]
            bookmark_id = str(item.get("id", ""))[:80]
            if not title or not url or not url.startswith(("http://", "https://")):
                continue
            cleaned.append({"id": bookmark_id, "title": title, "url": url, "icon": icon})
        hass.data[DOMAIN]["data"] = {"bookmarks": cleaned}
        await store.async_save(hass.data[DOMAIN]["data"])

    hass.services.async_register(DOMAIN, "save_bookmarks", save_bookmarks)

    # Register authenticated WebSocket commands for reading and saving data.
    from homeassistant.components import websocket_api

    @websocket_api.websocket_command({vol.Required("type"): "ha_bookmarks/get"})
    @websocket_api.async_response
    async def ws_get(hass, connection, msg):
        connection.send_result(msg["id"], hass.data[DOMAIN]["data"])

    @websocket_api.websocket_command({
        vol.Required("type"): "ha_bookmarks/save",
        vol.Required("bookmarks"): list,
    })
    @websocket_api.async_response
    async def ws_save(hass, connection, msg):
        bookmarks = msg["bookmarks"]
        if len(bookmarks) > 500:
            connection.send_error(msg["id"], "invalid_format", "Too many bookmarks")
            return
        cleaned = []
        for item in bookmarks:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()[:100]
            url = str(item.get("url", "")).strip()[:2048]
            if not title or not url or not url.startswith(("http://", "https://")):
                continue
            cleaned.append({
                "id": str(item.get("id", ""))[:80],
                "title": title,
                "url": url,
                "icon": str(item.get("icon", "mdi:bookmark"))[:80],
            })
        hass.data[DOMAIN]["data"] = {"bookmarks": cleaned}
        await store.async_save(hass.data[DOMAIN]["data"])
        connection.send_result(msg["id"], {"success": True})

    hass.data[DOMAIN]["ws_unsub"] = [
        websocket_api.async_register_command(hass, ws_get),
        websocket_api.async_register_command(hass, ws_save),
    ]

    panel_file = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths([
        StaticPathConfig("/ha-bookmarks", str(panel_file), cache_headers=False)
    ])
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="ha-bookmarks-panel",
        frontend_url_path=PANEL_PATH,
        sidebar_title="Bokmärken",
        sidebar_icon="mdi:bookmark-multiple",
        module_url="/ha-bookmarks/ha-bookmarks-panel.js",
        embed_iframe=False,
        require_admin=True,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    for unsub in hass.data.get(DOMAIN, {}).get("ws_unsub", []):
        unsub()
    hass.data.pop(DOMAIN, None)
    return True
