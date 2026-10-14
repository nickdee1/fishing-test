# Тренажёр теста рыбарских знаний (ČRS)

403 официальных вопроса с https://old.rybsvaz.cz/beta/index.php/legislativa/test-rybarskych-znalosti
лежат в `src/data/questions.json`, картинки рыб — в `public/img`.

```bash
npm install
npm run dev      # http://localhost:3000
```

Деплой: запушить в GitHub → Import в Vercel (настройки по умолчанию), или `npx vercel`.

Прогресс, ошибки и закладки хранятся в localStorage браузера.
`scripts/parse.py` — парсер исходных страниц (`?page=testrz/sotazek&tema=1..5`, кодировка cp1250).
