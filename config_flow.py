from homeassistant import config_entries
from .const import DOMAIN


class HABookmarksConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            return self.async_create_entry(title="Bokmärken", data={})
        return self.async_show_form(step_id="user")
