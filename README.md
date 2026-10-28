# Home Assistant Bookmarks

En enkel egen panel i Home Assistant för att spara bokmärken med namn och URL. Länkar öppnas i nya flikar.

## Funktioner

- Egen sida i sidomenyn
- Lägg till, redigera och ta bort bokmärken
- Sparas i Home Assistants `.storage`-lagring
- Öppnar länkar i nya flikar
- Kräver inloggad Home Assistant-användare

## Installation (testversion)

1. Lägg mappen `custom_components/ha_bookmarks` i Home Assistants `config/custom_components/`.
2. Starta om Home Assistant.
3. Gå till **Inställningar → Enheter och tjänster → Lägg till integration**.
4. Sök efter **Home Assistant Bookmarks** och lägg till den.

För HACS-installation behövs även ett publikt GitHub-repository med rätt filer och en release. Denna testversion är inte officiellt granskad eller testad mot alla Home Assistant-versioner.

## Utvecklingsstatus

Första utvecklingsutkast. Testa gärna i en separat/testmiljö innan användning i en viktig installation.
