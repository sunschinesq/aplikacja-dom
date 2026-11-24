-- Nasz dom: poranne powiadomienie o 7:30, wieczorne o 19:30 (czasu polskiego, także po zmianie czasu).
-- Harmonogram działa w UTC, więc odpala się o dwóch porach, a funkcja wysyła tylko o właściwej.
select cron.schedule('naszdom-rano', '30 5,6 * * *', $$ select notify_call('{"action":"daily"}'::jsonb) $$);
select cron.schedule('naszdom-wieczor', '30 17,18 * * *', $$ select notify_call('{"action":"evening"}'::jsonb) $$);
