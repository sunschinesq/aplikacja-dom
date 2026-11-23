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
5. W aplikacji: **Więcej → Ustawienia → Synchronizacja**: wklej adres, klucz i wymyśl **kod domu** (np. `zielony-kubek-47` (wymyśl własny, nie podawaj go nikomu)) → **Połącz**.
6. Na telefonie Franka: to samo, z tym samym kodem.

Klucz „anon” jest publiczny z założenia, więc można go trzymać w aplikacji. Dane chroni kod domu i reguły bazy: prywatne wydatki widzi tylko ich właściciel.

## Kopia zapasowa

Darmowy Supabase nie robi kopii. Raz na jakiś czas: **Ustawienia → Pobierz kopię** i wrzuć plik na Dysk Google.
