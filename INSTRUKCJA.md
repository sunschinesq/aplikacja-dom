# Nasz dom: jak uruchomić

Aplikacja działa w przeglądarce. Na iPhonie dodajesz ją do ekranu głównego i wtedy zachowuje się jak zwykła aplikacja.

## 1. Opublikuj aplikację (GitHub Pages, za darmo)

1. Wejdź w repozytorium `aplikacja-dom` na github.com → **Settings** → **Pages**.
2. W „Build and deployment” wybierz **Source: Deploy from a branch**.
3. Branch: `main` (albo gałąź z aplikacją), folder: `/ (root)` → **Save**.
4. Po 1–2 minutach pojawi się adres typu `https://sunschinesq.github.io/aplikacja-dom/`.

## 2. Dodaj do ekranu głównego (iPhone)

Otwórz adres w **Safari** → przycisk **Udostępnij** → **Do ekranu początkowego**. Przy pierwszym uruchomieniu wybierz, kim jesteś (Julia / Franek).

## 3. Synchronizacja między telefonami (Supabase)

Bez tego kroku dane są tylko na jednym telefonie.

1. Załóż darmowe konto na **supabase.com** → **New project** (region: Frankfurt lub Warszawa, hasło do bazy zapisz gdzieś bezpiecznie).
2. W projekcie: **Authentication → Sign In / Providers → Allow anonymous sign-ins**: włącz.
3. **SQL Editor** → New query → wklej całą zawartość pliku `supabase/schema.sql` → **Run**.
4. **Project Settings → API**: skopiuj **Project URL** i klucz **anon public** (albo „publishable key”).
5. W aplikacji: **Więcej → Ustawienia → Synchronizacja**: wklej adres i klucz, wymyśl **kod domu** (min. 6 znaków, np. `zielony-kubek-47`, wymyśl własny i nie podawaj go nikomu) i ustaw swój **PIN** (4–8 cyfr) → **Połącz**.
6. Na telefonie Franka: ten sam adres, klucz i kod domu, a PIN Franek ustawia sam.

Osobę na telefonie wybiera się raz. Żeby podłączyć telefon jako inną osobę, trzeba znać jej PIN. Sprawdza to serwer, więc nie da się tego obejść w telefonie. Franek powinien podłączyć swój telefon od razu, bo dopóki nie ustawi PIN-u, jego miejsce jest wolne.

Klucz „anon” jest publiczny z założenia, więc można go trzymać w aplikacji. Dane chroni kod domu i reguły bazy: prywatne wydatki widzi tylko ich właściciel.

## 4. Powiadomienia

1. **SQL Editor** → New query → wklej `supabase/powiadomienia.sql` → **Run**.
2. W tym samym miejscu uruchom (z adresem Twojego projektu):
   `update push_config set fn_url = 'https://TWOJ-PROJEKT.supabase.co/functions/v1/notify';`
3. **Edge Functions** → **Deploy a new function** → **Via Editor**. Nazwa: `notify`. Wklej całą zawartość `supabase/functions/notify/index.ts` → **Deploy**.
4. W funkcji `notify` → **Details** (albo Settings): wyłącz **Verify JWT** / **Enforce JWT verification** → **Save**.
5. W aplikacji (otwartej z ikonki na ekranie głównym): **Ustawienia → Powiadomienia → Włącz na tym telefonie** → Zezwól → **Wyślij próbne**.

## 5. Grafik i zajęcia z kalendarza (automatycznie)

1. **SQL Editor** → wklej `supabase/kalendarz.sql` → **Run**.
2. Wklej nową wersję `supabase/functions/notify/index.ts` w funkcję `notify` (plik `index.ts`) → **Deploy updates**.
3. W aplikacji: **Więcej → Grafik → Automatycznie z kalendarza** → wklej link `.ics` / `webcal://` do kalendarza z pracy i ze studiów.

## Kopia zapasowa

Darmowy Supabase nie robi kopii. Raz na jakiś czas: **Ustawienia → Pobierz kopię** i wrzuć plik na Dysk Google.
