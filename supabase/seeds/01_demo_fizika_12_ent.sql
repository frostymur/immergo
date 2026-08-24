-- -----------------------------------------------------------------
-- 01_demo_fizika_12_ent.sql
-- Demo seed for the hackathon: single locked diagnostic config
-- (12 класс · Физика · ЕНТ) + the demo teacher's class.
-- Idempotent: safe to re-run.
-- -----------------------------------------------------------------

-- 1) Curated shared diagnostic test (15 questions, one per topic).
--    Served for the demo config in all three UI languages so the judge
--    gets the same curated test no matter which locale is active.
--    Other configs keep falling back to LLM generation (placeholder).
DELETE FROM public.diagnostic_tests
WHERE (subject = 'Физика' AND grade = 12 AND goal = 'ent')
   OR (subject = 'Physics' AND grade = 12 AND goal = 'ent')
   OR (subject = 'Физика' AND grade = 9 AND goal = 'ent');

INSERT INTO public.diagnostic_tests (subject, grade, goal, lang, questions)
VALUES
('Физика', 12, 'ent', 'ru', $json$[{"q":"Два точечных заряда разместили так, что расстояние между ними увеличилось в 2 раза. Как изменится сила Кулона между ними?","options":["В 2 раза уменьшится","В 2 раза увеличится","Не изменится","В 4 раза уменьшится"],"answer":3,"explain":"По закону Кулона F = k·q1·q2/r² — сила обратно пропорциональна квадрату расстояния.","topic":"Электростатика"},{"q":"Напряжение между двумя точками электрического поля равно 20 В. Какую работу совершит поле при перемещении заряда 3 мкКл?","options":["6 мДж","60 Дж","60 мДж","0,15 мДж"],"answer":2,"explain":"A = q·U = 3·10⁻³ · 20 = 6·10⁻² Дж = 60 мДж.","topic":"Электрическое поле"},{"q":"Емкость конденсатора 2 мкФ, напряжение на нём 10 В. Какая энергия запасена в конденсаторе?","options":["200 мкДж","20 мкДж","50 мкДж","100 мкДж"],"answer":3,"explain":"W = C·U²/2 = 2·10⁻⁶ · 100 / 2 = 10⁻⁴ Дж = 100 мкДж.","topic":"Конденсаторы"},{"q":"Через поперечное сечение проводника за 4 с прошёл заряд 12 Кл. Какой ток идёт по проводнику?","options":["3 А","0,33 А","48 А","1,5 А"],"answer":0,"explain":"I = q/t = 12 / 4 = 3 А.","topic":"Электрический ток"},{"q":"Два резистора R1 = 3 Ом и R2 = 6 Ом соединены параллельно. Каково общее сопротивление участка цепи?","options":["9 Ом","4,5 Ом","1,5 Ом","2 Ом"],"answer":3,"explain":"1/R = 1/R1 + 1/R2 → R = R1·R2/(R1+R2) = 18/9 = 2 Ом.","topic":"Постоянный ток"},{"q":"Какое количество теплоты выделится в сопротивлении 10 Ом за 1 минуту при силе тока 2 А?","options":["240 Дж","2400 Дж","120 Дж","24000 Дж"],"answer":1,"explain":"Q = I²·R·t = 4 · 10 · 60 = 2400 Дж (закон Джоуля-Ленца).","topic":"Закон Джоуля-Ленца"},{"q":"По какому правилу определяется направление силы Ампера, действующей на проводник с током в магнитном поле?","options":["Правил правой руки","Правил буравчика","Правила Ленца","Правил левой руки"],"answer":3,"explain":"Направление силы Ампера определяется по правилу левой руки.","topic":"Магнетизм"},{"q":"Магнитный поток через контур изменился с 0,4 Вб до 0,1 Вб за 0,2 с. Какова ЭДС индукции в контуре?","options":["0,75 В","0,075 В","1,5 В","2 В"],"answer":2,"explain":"ε = |ΔΦ|/Δt = 0,3 / 0,2 = 1,5 В (закон Фарадея).","topic":"Электромагнитная индукция"},{"q":"В колебательном контуре ёмкость конденсатора увеличили в 4 раза. Как изменится период свободных электромагнитных колебаний?","options":["В 4 раза больше","В 2 раза больше","В 2 раза меньше","Не изменится"],"answer":1,"explain":"T = 2π·√(L·C): при увеличении C в 4 раза период растёт в √4 = 2 раза.","topic":"Электромагнитные колебания"},{"q":"Свет входит из воздуха в воду (n = 1,33). Какова скорость света в воде? (c = 3·10⁸ м/с)","options":["4·10⁸ м/с","2,25·10⁸ м/с","1,33·10⁸ м/с","3·10⁸ м/с"],"answer":1,"explain":"v = c/n = 3·10⁸ / 1,33 ≈ 2,25·10⁸ м/с.","topic":"Преломление света"},{"q":"Предмет находится на расстоянии 30 см от собирающей линзы с фокусным расстоянием 20 см. На каком расстоянии от линзы образуется изображение?","options":["12 см","10 см","60 см","30 см"],"answer":2,"explain":"1/f = 1/F + 1/d → 1/d = 1/F − 1/f = 1/20 − 1/30 = 1/60 → d = 60 см.","topic":"Тонкая линза"},{"q":"Интерференция света является доказательством какой природы света?","options":["Корпускулярной природы","Волновой природы","Квантовой природы","Ничего не доказывает"],"answer":1,"explain":"Интерференция и дифракция — волновые свойства света.","topic":"Интерференция света"},{"q":"Красная граница фотоэффекта для металла соответствует частоте ν0. Светом с частотой 2ν0 освещают металл. Какова максимальная кинетическая энергия фотоэлектронов?","options":["h·ν0","2h·ν0","h·ν0/2","0"],"answer":0,"explain":"По уравнению Эйнштейна: Ek = h·2ν0 − h·ν0 = h·ν0.","topic":"Фотоэффект"},{"q":"Какова энергия фотона света с частотой 5·10¹⁴ Гц? (h = 6,6·10⁻³⁴ Дж·с)","options":["6·10⁻¹⁹ Дж","1,3·10⁻¹⁸ Дж","6,6·10⁻³⁴ Дж","3,3·10⁻¹⁹ Дж"],"answer":3,"explain":"E = h·ν = 6,6·10⁻³⁴ · 5·10¹⁴ = 3,3·10⁻¹⁹ Дж.","topic":"Фотоны"},{"q":"Период полураспада некоторого вещества равен 8 суткам. Какая доля ядер останется нераспавшейся через 16 суток?","options":["1/2","1/4","1/8","1/16"],"answer":1,"explain":"Прошло два периода полураспада: N = N0/2² = N0/4.","topic":"Радиоактивный распад"}]$json$),
('Физика', 12, 'ent', 'kz', $json$[{"q":"Два точечных заряда разместили так, что расстояние между ними увеличилось в 2 раза. Как изменится сила Кулона между ними?","options":["В 2 раза уменьшится","В 2 раза увеличится","Не изменится","В 4 раза уменьшится"],"answer":3,"explain":"По закону Кулона F = k·q1·q2/r² — сила обратно пропорциональна квадрату расстояния.","topic":"Электростатика"},{"q":"Напряжение между двумя точками электрического поля равно 20 В. Какую работу совершит поле при перемещении заряда 3 мкКл?","options":["6 мДж","60 Дж","60 мДж","0,15 мДж"],"answer":2,"explain":"A = q·U = 3·10⁻³ · 20 = 6·10⁻² Дж = 60 мДж.","topic":"Электрическое поле"},{"q":"Емкость конденсатора 2 мкФ, напряжение на нём 10 В. Какая энергия запасена в конденсаторе?","options":["200 мкДж","20 мкДж","50 мкДж","100 мкДж"],"answer":3,"explain":"W = C·U²/2 = 2·10⁻⁶ · 100 / 2 = 10⁻⁴ Дж = 100 мкДж.","topic":"Конденсаторы"},{"q":"Через поперечное сечение проводника за 4 с прошёл заряд 12 Кл. Какой ток идёт по проводнику?","options":["3 А","0,33 А","48 А","1,5 А"],"answer":0,"explain":"I = q/t = 12 / 4 = 3 А.","topic":"Электрический ток"},{"q":"Два резистора R1 = 3 Ом и R2 = 6 Ом соединены параллельно. Каково общее сопротивление участка цепи?","options":["9 Ом","4,5 Ом","1,5 Ом","2 Ом"],"answer":3,"explain":"1/R = 1/R1 + 1/R2 → R = R1·R2/(R1+R2) = 18/9 = 2 Ом.","topic":"Постоянный ток"},{"q":"Какое количество теплоты выделится в сопротивлении 10 Ом за 1 минуту при силе тока 2 А?","options":["240 Дж","2400 Дж","120 Дж","24000 Дж"],"answer":1,"explain":"Q = I²·R·t = 4 · 10 · 60 = 2400 Дж (закон Джоуля-Ленца).","topic":"Закон Джоуля-Ленца"},{"q":"По какому правилу определяется направление силы Ампера, действующей на проводник с током в магнитном поле?","options":["Правил правой руки","Правил буравчика","Правила Ленца","Правил левой руки"],"answer":3,"explain":"Направление силы Ампера определяется по правилу левой руки.","topic":"Магнетизм"},{"q":"Магнитный поток через контур изменился с 0,4 Вб до 0,1 Вб за 0,2 с. Какова ЭДС индукции в контуре?","options":["0,75 В","0,075 В","1,5 В","2 В"],"answer":2,"explain":"ε = |ΔΦ|/Δt = 0,3 / 0,2 = 1,5 В (закон Фарадея).","topic":"Электромагнитная индукция"},{"q":"В колебательном контуре ёмкость конденсатора увеличили в 4 раза. Как изменится период свободных электромагнитных колебаний?","options":["В 4 раза больше","В 2 раза больше","В 2 раза меньше","Не изменится"],"answer":1,"explain":"T = 2π·√(L·C): при увеличении C в 4 раза период растёт в √4 = 2 раза.","topic":"Электромагнитные колебания"},{"q":"Свет входит из воздуха в воду (n = 1,33). Какова скорость света в воде? (c = 3·10⁸ м/с)","options":["4·10⁸ м/с","2,25·10⁸ м/с","1,33·10⁸ м/с","3·10⁸ м/с"],"answer":1,"explain":"v = c/n = 3·10⁸ / 1,33 ≈ 2,25·10⁸ м/с.","topic":"Преломление света"},{"q":"Предмет находится на расстоянии 30 см от собирающей линзы с фокусным расстоянием 20 см. На каком расстоянии от линзы образуется изображение?","options":["12 см","10 см","60 см","30 см"],"answer":2,"explain":"1/f = 1/F + 1/d → 1/d = 1/F − 1/f = 1/20 − 1/30 = 1/60 → d = 60 см.","topic":"Тонкая линза"},{"q":"Интерференция света является доказательством какой природы света?","options":["Корпускулярной природы","Волновой природы","Квантовой природы","Ничего не доказывает"],"answer":1,"explain":"Интерференция и дифракция — волновые свойства света.","topic":"Интерференция света"},{"q":"Красная граница фотоэффекта для металла соответствует частоте ν0. Светом с частотой 2ν0 освещают металл. Какова максимальная кинетическая энергия фотоэлектронов?","options":["h·ν0","2h·ν0","h·ν0/2","0"],"answer":0,"explain":"По уравнению Эйнштейна: Ek = h·2ν0 − h·ν0 = h·ν0.","topic":"Фотоэффект"},{"q":"Какова энергия фотона света с частотой 5·10¹⁴ Гц? (h = 6,6·10⁻³⁴ Дж·с)","options":["6·10⁻¹⁹ Дж","1,3·10⁻¹⁸ Дж","6,6·10⁻³⁴ Дж","3,3·10⁻¹⁹ Дж"],"answer":3,"explain":"E = h·ν = 6,6·10⁻³⁴ · 5·10¹⁴ = 3,3·10⁻¹⁹ Дж.","topic":"Фотоны"},{"q":"Период полураспада некоторого вещества равен 8 суткам. Какая доля ядер останется нераспавшейся через 16 суток?","options":["1/2","1/4","1/8","1/16"],"answer":1,"explain":"Прошло два периода полураспада: N = N0/2² = N0/4.","topic":"Радиоактивный распад"}]$json$),
('Physics', 12, 'ent', 'en', $json$[{"q":"Two point charges are placed so that the distance between them is doubled. How does the Coulomb force between them change?","options":["Halves","Doubles","Stays the same","Becomes 4 times smaller"],"answer":3,"explain":"Coulomb's law F = k·q1·q2/r² — force is inversely proportional to the square of the distance.","topic":"Электростатика"},{"q":"The voltage between two points of an electric field is 20 V. How much work does the field do moving a charge of 3 mC?","options":["6 mJ","60 J","60 mJ","0.15 mJ"],"answer":2,"explain":"A = q·U = 3·10⁻³ · 20 = 6·10⁻² J = 60 mJ.","topic":"Электрическое поле"},{"q":"A capacitor has capacitance 2 µF and voltage 10 V. What energy is stored in it?","options":["200 µJ","20 µJ","50 µJ","100 µJ"],"answer":3,"explain":"W = C·U²/2 = 2·10⁻⁶ · 100 / 2 = 10⁻⁴ J = 100 µJ.","topic":"Конденсаторы"},{"q":"A charge of 12 C passes through a conductor cross-section in 4 s. What is the current?","options":["3 A","0.33 A","48 A","1.5 A"],"answer":0,"explain":"I = q/t = 12 / 4 = 3 A.","topic":"Электрический ток"},{"q":"Resistors R1 = 3 Ω and R2 = 6 Ω are connected in parallel. What is the total resistance?","options":["9 Ω","4.5 Ω","1.5 Ω","2 Ω"],"answer":3,"explain":"1/R = 1/R1 + 1/R2 → R = R1·R2/(R1+R2) = 18/9 = 2 Ω.","topic":"Постоянный ток"},{"q":"How much heat is released by a 10 Ω resistor in 1 minute with a current of 2 A?","options":["240 J","2400 J","120 J","24000 J"],"answer":1,"explain":"Q = I²·R·t = 4 · 10 · 60 = 2400 J (Joule-Lenz law).","topic":"Закон Джоуля-Ленца"},{"q":"Which rule gives the direction of the Ampere force on a current-carrying wire in a magnetic field?","options":["Right-hand rule","Right-screw rule","Lenz's rule","Left-hand rule"],"answer":3,"explain":"The direction of the Ampere force is given by the left-hand rule.","topic":"Магнетизм"},{"q":"The magnetic flux through a loop changes from 0.4 Wb to 0.1 Wb in 0.2 s. What is the induced EMF?","options":["0.75 V","0.075 V","1.5 V","2 V"],"answer":2,"explain":"ε = |ΔΦ|/Δt = 0.3 / 0.2 = 1.5 V (Faraday's law).","topic":"Электромагнитная индукция"},{"q":"In an LC circuit the capacitance is increased 4-fold. How does the oscillation period change?","options":["4 times larger","2 times larger","2 times smaller","Unchanged"],"answer":1,"explain":"T = 2π·√(L·C): quadrupling C grows the period by √4 = 2.","topic":"Электромагнитные колебания"},{"q":"Light enters water from air (n = 1.33). What is the speed of light in water? (c = 3·10⁸ m/s)","options":["4·10⁸ m/s","2.25·10⁸ m/s","1.33·10⁸ m/s","3·10⁸ m/s"],"answer":1,"explain":"v = c/n = 3·10⁸ / 1.33 ≈ 2.25·10⁸ m/s.","topic":"Преломление света"},{"q":"An object is 30 cm from a converging lens with focal length 20 cm. Where is the image formed?","options":["12 cm","10 cm","60 cm","30 cm"],"answer":2,"explain":"1/d = 1/F − 1/f = 1/20 − 1/30 = 1/60 → d = 60 cm.","topic":"Тонкая линза"},{"q":"Light interference proves which nature of light?","options":["Corpuscular nature","Wave nature","Quantum nature","It proves nothing"],"answer":1,"explain":"Interference and diffraction are wave properties of light.","topic":"Интерференция света"},{"q":"The red-limit frequency of a metal is ν0. Light of frequency 2ν0 shines on it. What is the max kinetic energy of photoelectrons?","options":["h·ν0","2h·ν0","h·ν0/2","0"],"answer":0,"explain":"Einstein's equation: Ek = h·2ν0 − h·ν0 = h·ν0.","topic":"Фотоэффект"},{"q":"What is the energy of a photon with frequency 5·10¹⁴ Hz? (h = 6.6·10⁻³⁴ J·s)","options":["6·10⁻¹⁹ J","1.3·10⁻¹⁸ J","6.6·10⁻³⁴ J","3.3·10⁻¹⁹ J"],"answer":3,"explain":"E = h·ν = 6.6·10⁻³⁴ · 5·10¹⁴ = 3.3·10⁻¹⁹ J.","topic":"Фотоны"},{"q":"The half-life of a substance is 8 days. What fraction of nuclei remains after 16 days?","options":["1/2","1/4","1/8","1/16"],"answer":1,"explain":"Two half-lives have passed: N = N0/2² = N0/4.","topic":"Радиоактивный распад"}]$json$)
ON CONFLICT (subject, grade, goal, lang) DO UPDATE SET questions = EXCLUDED.questions;

-- 2) Demo class: rename to match the locked config.
UPDATE public.workspaces
SET title = 'Физика 12', grade = '12'
WHERE id = (SELECT id FROM public.workspaces WHERE title = 'Physics 09' LIMIT 1);

-- 3) Demo students: grade 12 (diagnostic prefill / consistency).
UPDATE public.profiles
SET grade = '12'
WHERE id IN (
    SELECT id FROM public.profiles
    WHERE email IN ('aigul.student@demo.kz','nurbol.student@demo.kz','dana.student@demo.kz')
);

-- 4) Demo students' diagnostics on the 12-grade test (per-topic answers
--    power the teacher's struggling-topics analytics).
DELETE FROM public.diagnostic_results
WHERE user_id IN (
    SELECT id FROM public.profiles
    WHERE email IN ('aigul.student@demo.kz','nurbol.student@demo.kz','dana.student@demo.kz')
)
AND subject = 'Физика';

INSERT INTO public.diagnostic_results
    (user_id, subject, grade, goal, correct, total, level, feedback, weak_topics, recommendation, answers, created_at)
VALUES
((SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz'), 'Физика', 12, 'ent', 12, 15, 'advanced',
 'Сильная база по электротехнике. Закройте пробелы в волновой оптике и квантовой физике — и уровень будет уверенно высоким.',
 $json$["Интерференция света","Фотоны","Радиоактивный распад"]$json$,
 'Пройдите модули по интерференции, фотоэфекту и ядерной физике, затем тренируйтесь на заданиях формата ЕНТ.',
 $json$[{"topic":"Электростатика","correct":true},{"topic":"Электрическое поле","correct":true},{"topic":"Конденсаторы","correct":true},{"topic":"Электрический ток","correct":true},{"topic":"Постоянный ток","correct":true},{"topic":"Закон Джоуля-Ленца","correct":true},{"topic":"Магнетизм","correct":true},{"topic":"Электромагнитная индукция","correct":true},{"topic":"Электромагнитные колебания","correct":true},{"topic":"Преломление света","correct":true},{"topic":"Тонкая линза","correct":true},{"topic":"Интерференция света","correct":false},{"topic":"Фотоэффект","correct":true},{"topic":"Фотоны","correct":false},{"topic":"Радиоактивный распад","correct":false}]$json$,
 NOW() - INTERVAL '3 days'),
((SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz'), 'Физика', 12, 'ent', 6, 15, 'beginner',
 'Большинство тем требуют повторения с основ. Начните с постоянного тока и электромагнитной индукции — на них строится вся электродинамика.',
 $json$["Постоянный ток","Электромагнитная индукция","Электромагнитные колебания"]$json$,
 'Начните с повторения основ электротехники в своём темпе, без пропусков, затем переходите к оптике.',
 $json$[{"topic":"Электростатика","correct":true},{"topic":"Электрическое поле","correct":true},{"topic":"Конденсаторы","correct":true},{"topic":"Электрический ток","correct":true},{"topic":"Постоянный ток","correct":false},{"topic":"Закон Джоуля-Ленца","correct":true},{"topic":"Магнетизм","correct":true},{"topic":"Электромагнитная индукция","correct":false},{"topic":"Электромагнитные колебания","correct":false},{"topic":"Преломление света","correct":false},{"topic":"Тонкая линза","correct":false},{"topic":"Интерференция света","correct":false},{"topic":"Фотоэффект","correct":false},{"topic":"Фотоны","correct":false},{"topic":"Радиоактивный распад","correct":false}]$json$,
 NOW() - INTERVAL '2 days'),
((SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz'), 'Физика', 12, 'ent', 9, 15, 'intermediate',
 'Хорошая база, но есть разрыв в электромагнитной индукции и линзах. Запланируйте практику по этим темам первой.',
 $json$["Конденсаторы","Электромагнитная индукция","Тонкая линза"]$json$,
 'Сфокусируйтесь на индукции и тонкой линзе: теория + 10-15 задач, затем контрольная диагностика.',
 $json$[{"topic":"Электростатика","correct":true},{"topic":"Электрическое поле","correct":true},{"topic":"Конденсаторы","correct":false},{"topic":"Электрический ток","correct":true},{"topic":"Постоянный ток","correct":true},{"topic":"Закон Джоуля-Ленца","correct":true},{"topic":"Магнетизм","correct":true},{"topic":"Электромагнитная индукция","correct":false},{"topic":"Электромагнитные колебания","correct":true},{"topic":"Преломление света","correct":true},{"topic":"Тонкая линза","correct":false},{"topic":"Интерференция света","correct":true},{"topic":"Фотоэффект","correct":false},{"topic":"Фотоны","correct":false},{"topic":"Радиоактивный распад","correct":false}]$json$,
 NOW() - INTERVAL '1 day');

-- 4b) Earlier diagnostic attempts, so the teacher sees the re-take trend
--     (both students improved after studying the weak topics).
INSERT INTO public.diagnostic_results
    (user_id, subject, grade, goal, correct, total, level, feedback, weak_topics, recommendation, answers, created_at)
VALUES
((SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz'), 'Физика', 12, 'ent', 10, 15, 'intermediate',
 'База есть, но волновая оптика и квантовая физика даются с трудом. Нужна практика по этим блокам.',
 $json$["Преломление света","Электромагнитные колебания","Интерференция света"]$json$,
 'Повторите оптику и начните с основ квантовой физики.',
 $json$[{"topic":"Электростатика","correct":true},{"topic":"Электрическое поле","correct":true},{"topic":"Конденсаторы","correct":true},{"topic":"Электрический ток","correct":true},{"topic":"Постоянный ток","correct":true},{"topic":"Закон Джоуля-Ленца","correct":true},{"topic":"Магнетизм","correct":true},{"topic":"Электромагнитная индукция","correct":true},{"topic":"Электромагнитные колебания","correct":false},{"topic":"Преломление света","correct":false},{"topic":"Тонкая линза","correct":true},{"topic":"Интерференция света","correct":false},{"topic":"Фотоэффект","correct":true},{"topic":"Фотоны","correct":false},{"topic":"Радиоактивный распад","correct":false}]$json$,
 NOW() - INTERVAL '10 days'),
((SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz'), 'Физика', 12, 'ent', 4, 15, 'beginner',
 'Почти все темы требуют начального уровня. Начните с основ электростатики и тока.',
 $json$["Конденсаторы","Постоянный ток","Закон Джоуля-Ленца"]$json$,
 'Начните с самых основ: закон Ома, сопротивление, затем магнетизм.',
 $json$[{"topic":"Электростатика","correct":true},{"topic":"Электрическое поле","correct":true},{"topic":"Конденсаторы","correct":false},{"topic":"Электрический ток","correct":true},{"topic":"Постоянный ток","correct":false},{"topic":"Закон Джоуля-Ленца","correct":false},{"topic":"Магнетизм","correct":true},{"topic":"Электромагнитная индукция","correct":false},{"topic":"Электромагнитные колебания","correct":false},{"topic":"Преломление света","correct":false},{"topic":"Тонкая линза","correct":false},{"topic":"Интерференция света","correct":false},{"topic":"Фотоэффект","correct":false},{"topic":"Фотоны","correct":false},{"topic":"Радиоактивный распад","correct":false}]$json$,
 NOW() - INTERVAL '10 days');

-- 4c) Math diagnostics — so the class has a second subject tab and the
--     teacher can compare per-subject statistics.
INSERT INTO public.diagnostic_results
    (user_id, subject, grade, goal, correct, total, level, feedback, weak_topics, recommendation, answers, created_at)
VALUES
((SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz'), 'Математика', 12, 'ent', 11, 15, 'intermediate',
 'Сильная база по алгебре и геометрии. Повторите пределы и логарифмы — они обязательны для ЕНТ.',
 $json$["Пределы","Показатели и логарифмы","Стереометрия"]$json$,
 'Закройте пределы и логарифмические уравнения, затем решите демо-вариант ЕНТ.',
 $json$[{"topic":"Функции","correct":true},{"topic":"Уравнения и неравенства","correct":true},{"topic":"Тригонометрия","correct":true},{"topic":"Последовательности","correct":true},{"topic":"Пределы","correct":false},{"topic":"Производная","correct":true},{"topic":"Приложения производной","correct":true},{"topic":"Показатели и логарифмы","correct":false},{"topic":"Показательные и логарифмические уравнения","correct":true},{"topic":"Векторы","correct":true},{"topic":"Вероятность","correct":true},{"topic":"Комбинаторика","correct":true},{"topic":"Окружность и углы","correct":true},{"topic":"Стереометрия","correct":false},{"topic":"Статистика","correct":false}]$json$,
 NOW() - INTERVAL '6 days'),
((SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz'), 'Математика', 12, 'ent', 3, 15, 'beginner',
 'База слабая: почти все темы требуют повторения с основ 9-10 классов.',
 $json$["Тригонометрия","Последовательности","Пределы"]$json$,
 'Начните с базовой алгебры: уравнения, функции, затем тригонометрия.',
 $json$[{"topic":"Функции","correct":true},{"topic":"Уравнения и неравенства","correct":true},{"topic":"Тригонометрия","correct":false},{"topic":"Последовательности","correct":false},{"topic":"Пределы","correct":false},{"topic":"Производная","correct":false},{"topic":"Приложения производной","correct":false},{"topic":"Показатели и логарифмы","correct":false},{"topic":"Показательные и логарифмические уравнения","correct":false},{"topic":"Векторы","correct":true},{"topic":"Вероятность","correct":false},{"topic":"Комбинаторика","correct":false},{"topic":"Окружность и углы","correct":false},{"topic":"Стереометрия","correct":false},{"topic":"Статистика","correct":false}]$json$,
 NOW() - INTERVAL '6 days'),
((SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz'), 'Математика', 12, 'ent', 8, 15, 'intermediate',
 'Уверенная база, но есть пробелы в пределе и комбинаторике.',
 $json$["Пределы","Последовательности","Вероятность"]$json$,
 'Повторите пределы и последовательности, добавьте практику по комбинаторике.',
 $json$[{"topic":"Функции","correct":true},{"topic":"Уравнения и неравенства","correct":true},{"topic":"Тригонометрия","correct":true},{"topic":"Последовательности","correct":false},{"topic":"Пределы","correct":false},{"topic":"Производная","correct":true},{"topic":"Приложения производной","correct":true},{"topic":"Показатели и логарифмы","correct":false},{"topic":"Показательные и логарифмические уравнения","correct":true},{"topic":"Векторы","correct":true},{"topic":"Вероятность","correct":false},{"topic":"Комбинаторика","correct":false},{"topic":"Окружность и углы","correct":true},{"topic":"Стереометрия","correct":false},{"topic":"Статистика","correct":false}]$json$,
 NOW() - INTERVAL '4 days');

-- 4d) Roadmap plans + stage progress, so the teacher sees course completion
--     (a first-class readiness signal next to the test).
DELETE FROM public.roadmap_plans
WHERE user_id IN (
    SELECT id FROM public.profiles
    WHERE email IN ('aigul.student@demo.kz','nurbol.student@demo.kz','dana.student@demo.kz')
)
AND topic IN ('Физика', 'Математика');

INSERT INTO public.roadmap_plans (id, user_id, topic, goal, level, stages, total_weeks, deadline, created_at)
VALUES
(gen_random_uuid(), (SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz'), 'Физика', 'ent', 'advanced',
 $json$[{"title":"Основы: механика","topics":["Кинематика","Динамика","Работа и энергия"],"material":"Повторение кинематики и динамики, разбор типовых задач.","check":"Решить 10 задач на кинематику без ошибок."},{"title":"Электростатика и ток","topics":["Электростатика","Электрическое поле","Конденсаторы","Электрический ток"],"material":"Закон Кулона, электрическое поле, ёмкость, закон Ома.","check":"Самостоятельная работа: 8 задач по электростатике."},{"title":"Цепи и закон Джоуля-Ленца","topics":["Постоянный ток","Закон Джоуля-Ленца","Магнетизм"],"material":"Смешанные цепи, тепловое действие тока, сила Ампера.","check":"Рассчитать сопротивление смешанной цепи."},{"title":"Электромагнитная индукция","topics":["Электромагнитная индукция","Правило Ленца","Самоиндукция"],"material":"Закон Фарадея, ЭДС индукции, индуктивность.","check":"10 задач на закон Фарадея."},{"title":"Колебания и волны","topics":["Электромагнитные колебания","Свободные колебания"],"material":"Колебательный контур, период, энергия.","check":"Найти период контура при изменении C и L."},{"title":"Оптика и квантовая физика","topics":["Преломление света","Тонкая линза","Интерференция","Фотоэффект","Фотоны","Радиоактивный распад"],"material":"Геометрическая оптика, волновые и квантовые эффекты, ядерная физика.","check":"Мини-тест: 15 вопросов по оптике и квантам."},{"title":"Мок-тест ЕНТ","topics":["Формат экзамена","Работа на время"],"material":"Полный вариант в формате ЕНТ с таймингом.","check":"Мок-тест из 50 вопросов за 180 минут."}]$json$,
 7, NOW() + INTERVAL '49 days', NOW() - INTERVAL '9 days'),
(gen_random_uuid(), (SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz'), 'Физика', 'ent', 'beginner',
 $json$[{"title":"Основы: механика","topics":["Кинематика","Динамика","Работа и энергия"],"material":"Повторение кинематики и динамики, разбор типовых задач.","check":"Решить 10 задач на кинематику без ошибок."},{"title":"Электростатика и ток","topics":["Электростатика","Электрическое поле","Конденсаторы","Электрический ток"],"material":"Закон Кулона, электрическое поле, ёмкость, закон Ома.","check":"Самостоятельная работа: 8 задач по электростатике."},{"title":"Цепи и закон Джоуля-Ленца","topics":["Постоянный ток","Закон Джоуля-Ленца","Магнетизм"],"material":"Смешанные цепи, тепловое действие тока, сила Ампера.","check":"Рассчитать сопротивление смешанной цепи."},{"title":"Электромагнитная индукция","topics":["Электромагнитная индукция","Правило Ленца","Самоиндукция"],"material":"Закон Фарадея, ЭДС индукции, индуктивность.","check":"10 задач на закон Фарадея."},{"title":"Колебания и волны","topics":["Электромагнитные колебания","Свободные колебания"],"material":"Колебательный контур, период, энергия.","check":"Найти период контура при изменении C и L."},{"title":"Оптика и квантовая физика","topics":["Преломление света","Тонкая линза","Интерференция","Фотоэффект","Фотоны","Радиоактивный распад"],"material":"Геометрическая оптика, волновые и квантовые эффекты, ядерная физика.","check":"Мини-тест: 15 вопросов по оптике и квантам."},{"title":"Мок-тест ЕНТ","topics":["Формат экзамена","Работа на время"],"material":"Полный вариант в формате ЕНТ с таймингом.","check":"Мок-тест из 50 вопросов за 180 минут."}]$json$,
 7, NOW() + INTERVAL '49 days', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), (SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz'), 'Физика', 'ent', 'intermediate',
 $json$[{"title":"Основы: механика","topics":["Кинематика","Динамика","Работа и энергия"],"material":"Повторение кинематики и динамики, разбор типовых задач.","check":"Решить 10 задач на кинематику без ошибок."},{"title":"Электростатика и ток","topics":["Электростатика","Электрическое поле","Конденсаторы","Электрический ток"],"material":"Закон Кулона, электрическое поле, ёмкость, закон Ома.","check":"Самостоятельная работа: 8 задач по электростатике."},{"title":"Цепи и закон Джоуля-Ленца","topics":["Постоянный ток","Закон Джоуля-Ленца","Магнетизм"],"material":"Смешанные цепи, тепловое действие тока, сила Ампера.","check":"Рассчитать сопротивление смешанной цепи."},{"title":"Электромагнитная индукция","topics":["Электромагнитная индукция","Правило Ленца","Самоиндукция"],"material":"Закон Фарадея, ЭДС индукции, индуктивность.","check":"10 задач на закон Фарадея."},{"title":"Колебания и волны","topics":["Электромагнитные колебания","Свободные колебания"],"material":"Колебательный контур, период, энергия.","check":"Найти период контура при изменении C и L."},{"title":"Оптика и квантовая физика","topics":["Преломление света","Тонкая линза","Интерференция","Фотоэффект","Фотоны","Радиоактивный распад"],"material":"Геометрическая оптика, волновые и квантовые эффекты, ядерная физика.","check":"Мини-тест: 15 вопросов по оптике и квантам."},{"title":"Мок-тест ЕНТ","topics":["Формат экзамена","Работа на время"],"material":"Полный вариант в формате ЕНТ с таймингом.","check":"Мок-тест из 50 вопросов за 180 минут."}]$json$,
 7, NOW() + INTERVAL '49 days', NOW() - INTERVAL '7 days'),
(gen_random_uuid(), (SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz'), 'Математика', 'ent', 'intermediate',
 $json$[{"title":"Основы: функции и уравнения","topics":["Функции","Уравнения и неравенства"],"material":"Свойства функций, типы уравнений, области определения.","check":"Решить 12 уравнений разной сложности."},{"title":"Тригонометрия","topics":["Тригонометрические функции","Тригонометрические уравнения"],"material":"Формулы сокращённого умножения, периодичность.","check":"Решить 8 тригонометрических уравнений."},{"title":"Последовательности и пределы","topics":["Последовательности","Пределы"],"material":"Арифметическая и геометрическая прогрессии, вычисление пределов.","check":"Найти предел и член прогрессии: 10 задач."},{"title":"Производная и её приложения","topics":["Производная","Приложения производной"],"material":"Таблица производных, исследование функций, экстремумы.","check":"Построить график функции с производной."},{"title":"Показатели и логарифмы","topics":["Показатели и логарифмы","Показательные и логарифмические уравнения"],"material":"Свойства степеней и логарифмов, решение уравнений.","check":"Решить 10 показательных и логарифмических уравнений."},{"title":"Геометрия: векторы и стереометрия","topics":["Векторы","Окружность и углы","Стереометрия"],"material":"Векторные операции, планиметрика, объёмы и площади.","check":"Мини-тест по геометрии: 12 вопросов."},{"title":"Мок-тест ЕНТ","topics":["Формат экзамена","Работа на время"],"material":"Полный вариант в формате ЕНТ с таймингом.","check":"Мок-тест из 50 вопросов за 180 минут."}]$json$,
 7, NOW() + INTERVAL '49 days', NOW() - INTERVAL '8 days'),
(gen_random_uuid(), (SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz'), 'Математика', 'ent', 'intermediate',
 $json$[{"title":"Основы: функции и уравнения","topics":["Функции","Уравнения и неравенства"],"material":"Свойства функций, типы уравнений, области определения.","check":"Решить 12 уравнений разной сложности."},{"title":"Тригонометрия","topics":["Тригонометрические функции","Тригонометрические уравнения"],"material":"Формулы сокращённого умножения, периодичность.","check":"Решить 8 тригонометрических уравнений."},{"title":"Последовательности и пределы","topics":["Последовательности","Пределы"],"material":"Арифметическая и геометрическая прогрессии, вычисление пределов.","check":"Найти предел и член прогрессии: 10 задач."},{"title":"Производная и её приложения","topics":["Производная","Приложения производной"],"material":"Таблица производных, исследование функций, экстремумы.","check":"Построить график функции с производной."},{"title":"Показатели и логарифмы","topics":["Показатели и логарифмы","Показательные и логарифмические уравнения"],"material":"Свойства степеней и логарифмов, решение уравнений.","check":"Решить 10 показательных и логарифмических уравнений."},{"title":"Геометрия: векторы и стереометрия","topics":["Векторы","Окружность и углы","Стереометрия"],"material":"Векторные операции, планиметрика, объёмы и площади.","check":"Мини-тест по геометрии: 12 вопросов."},{"title":"Мок-тест ЕНТ","topics":["Формат экзамена","Работа на время"],"material":"Полный вариант в формате ЕНТ с таймингом.","check":"Мок-тест из 50 вопросов за 180 минут."}]$json$,
 7, NOW() + INTERVAL '49 days', NOW() - INTERVAL '6 days');

-- Stage completion per student (physics: 5/3/1 of 7, math: 3/2/0 of 7).
INSERT INTO public.roadmap_progress (plan_id, user_id, stage_index)
SELECT p.id, p.user_id, g.i
FROM public.roadmap_plans p
CROSS JOIN generate_series(0, 6) AS g(i)
WHERE p.topic = 'Физика'
  AND ((p.user_id = (SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz') AND g.i < 5)
    OR (p.user_id = (SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz') AND g.i < 3)
    OR (p.user_id = (SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz') AND g.i < 1))
ON CONFLICT DO NOTHING;

INSERT INTO public.roadmap_progress (plan_id, user_id, stage_index)
SELECT p.id, p.user_id, g.i
FROM public.roadmap_plans p
CROSS JOIN generate_series(0, 6) AS g(i)
WHERE p.topic = 'Математика'
  AND ((p.user_id = (SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz') AND g.i < 3)
    OR (p.user_id = (SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz') AND g.i < 2))
ON CONFLICT DO NOTHING;

-- 5) Demo homework: retarget to a 12-grade struggling topic and keep the
--    deadline 2 days out so the student's "deadline reminders" panel is
--    populated on first login.
UPDATE public.assignments
SET title = 'Повторение: Электромагнитная индукция',
    topic = 'Электромагнитная индукция',
    description = 'Разбор задач на закон Фарадея и правило Ленца.',
    deadline = NOW() + INTERVAL '2 days'
WHERE workspace_id = (SELECT id FROM public.workspaces WHERE title = 'Физика 12' LIMIT 1)
  AND title = 'Повторение: Электромагнитная индукция';

-- 6) Spaced-repetition queue (013): aigul and nurbol have reviews that are
--    already due (weak topic: electromagnetic induction), nurbol has one
--    coming due within a day, dana is on schedule.
INSERT INTO public.review_schedule (user_id, node_id, fail_count, next_review_at) VALUES
  ((SELECT id FROM public.profiles WHERE email = 'aigul.student@demo.kz'), 'lesson:электромагнитная-индукция', 2, NOW() - INTERVAL '6 hours'),
  ((SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz'), 'lesson:электромагнитная-индукция', 3, NOW() - INTERVAL '1 day'),
  ((SELECT id FROM public.profiles WHERE email = 'nurbol.student@demo.kz'), 'lesson:колебания-и-волны', 1, NOW() + INTERVAL '20 hours'),
  ((SELECT id FROM public.profiles WHERE email = 'dana.student@demo.kz'), 'lesson:колебания-и-волны', 2, NOW() + INTERVAL '36 hours')
ON CONFLICT (user_id, node_id) DO UPDATE
    SET fail_count = EXCLUDED.fail_count,
        next_review_at = EXCLUDED.next_review_at,
        updated_at = NOW();
