-- Dados FICTÍCIOS da "Clínica Exemplo" para testar o fluxo.
-- Preços, bairros e regras foram inventados; não são dados da Vaccine.

insert into public.vacinas_catalogo
  (id, idade, nome, protecao, doencas_prevenidas, publico_alvo, dose, esquema_vacinal, disponibilidade, valor, observacoes_ia, via_administracao, reacoes_comuns)
values
  (1, '2 meses', 'Hexa', 'Protege contra 6 doenças em uma única aplicação', 'Difteria, tétano, coqueluche, poliomielite, Haemophilus influenzae tipo b e hepatite B', 'Bebês a partir de 2 meses', '1ª, 2ª e 3ª doses', 'Aos 2, 4 e 6 meses, com reforço aos 15 meses', 'Disponível', 'R$ 380,00 no PIX ou R$ 400,00 no crédito', null, 'Intramuscular', 'Dor no local, febre baixa'),
  (2, '2 meses', 'Pneumocócica 20', 'Protege contra 20 tipos de pneumococo', 'Pneumonia, meningite e otite pneumocócicas', 'Bebês a partir de 2 meses', '1ª, 2ª e 3ª doses', 'Aos 2, 4 e 6 meses, com reforço aos 12-15 meses', 'Disponível', 'R$ 420,00 no PIX ou R$ 440,00 no crédito', null, 'Intramuscular', 'Dor e vermelhidão no local'),
  (3, 'Adulto', 'Pneumocócica 20', 'Protege contra 20 tipos de pneumococo', 'Pneumonia, meningite e otite pneumocócicas', 'Adultos e idosos', 'Dose única', 'Dose única', 'Disponível', 'R$ 450,00 no PIX ou R$ 470,00 no crédito', null, 'Intramuscular', 'Dor no local'),
  (4, '3 meses', 'Meningocócica B', 'Protege contra a meningite B', 'Doença meningocócica do sorogrupo B', 'Bebês a partir de 3 meses', '1ª e 2ª doses', 'Aos 3 e 5 meses, com reforço aos 12-15 meses', 'Disponível', 'R$ 560,00 no PIX ou R$ 590,00 no crédito', 'Pode causar febre; orientar antitérmico conforme pediatra.', 'Intramuscular', 'Febre, irritabilidade'),
  (5, '3 meses', 'Meningocócica ACWY', 'Protege contra 4 tipos de meningite', 'Doença meningocócica A, C, W e Y', 'Bebês a partir de 3 meses', '1ª e 2ª doses', 'Aos 3 e 5 meses, com reforço aos 12 meses', 'Disponível', 'R$ 360,00 no PIX ou R$ 380,00 no crédito', null, 'Intramuscular', 'Dor no local'),
  (6, '2 meses', 'Rotavírus Pentavalente', 'Protege contra diarreia grave por rotavírus', 'Gastroenterite por rotavírus', 'Bebês de 2 a 8 meses', '1ª, 2ª e 3ª doses', 'Aos 2, 4 e 6 meses', 'Disponível', 'R$ 300,00 no PIX ou R$ 320,00 no crédito', 'Idade máxima rígida: última dose até 8 meses e 0 dias.', 'Oral', 'Irritabilidade leve'),
  (7, '6 meses', 'Influenza Tetravalente', 'Protege contra 4 tipos do vírus da gripe', 'Gripe (influenza)', 'A partir de 6 meses', 'Dose anual', 'Anual; crianças abaixo de 9 anos na 1ª vez tomam 2 doses com 30 dias', 'Disponível', 'R$ 140,00 no PIX ou R$ 150,00 no crédito', null, 'Intramuscular', 'Dor no local'),
  (8, '12 meses', 'Varicela', 'Protege contra a catapora', 'Varicela', 'A partir de 12 meses', '1ª e 2ª doses', 'Aos 12 e 15 meses', 'Poucas doses', 'R$ 250,00 no PIX ou R$ 265,00 no crédito', null, 'Subcutânea', 'Febre baixa, manchas leves'),
  (9, '9 anos', 'HPV9', 'Protege contra 9 tipos de HPV', 'Cânceres e verrugas causados pelo HPV', 'De 9 a 45 anos', '2 ou 3 doses', '9 a 14 anos: 2 doses (0 e 6 meses). 15 anos ou mais: 3 doses (0, 2 e 6 meses)', 'Disponível', 'R$ 900,00 no PIX ou R$ 950,00 no crédito', null, 'Intramuscular', 'Dor no local, desmaio (aplicar sentado)'),
  (10, 'Adulto', 'Hepatite B', 'Protege contra a hepatite B', 'Hepatite B', 'Adultos não vacinados', '1ª, 2ª e 3ª doses', '0, 1 e 6 meses', 'Disponível', 'R$ 90,00', null, 'Intramuscular', 'Dor no local'),
  (11, '50 anos', 'Herpes Zóster', 'Protege contra o herpes-zóster (cobreiro)', 'Herpes-zóster e neuralgia pós-herpética', 'A partir de 50 anos', '1ª e 2ª doses', '2 doses com intervalo de 2 a 6 meses', 'Poucas doses', 'R$ 980,00 no PIX ou R$ 1.040,00 no crédito', null, 'Intramuscular', 'Dor, cansaço, febre por 1-2 dias'),
  (12, '4 anos', 'Dengue', 'Protege contra os 4 sorotipos da dengue', 'Dengue', 'De 4 a 60 anos', '1ª e 2ª doses', '2 doses com intervalo de 3 meses', 'Em falta', 'R$ 400,00 no PIX ou R$ 420,00 no crédito', 'Em falta: oferecer lista de espera (repassa_atendente).', 'Subcutânea', 'Dor no local, dor de cabeça'),
  (13, 'Gestação', 'VSR Gestante', 'Protege o bebê contra o vírus sincicial respiratório', 'Bronquiolite por VSR', 'Gestantes entre 32 e 36 semanas', 'Dose única', 'Dose única por gestação', 'Disponível', 'R$ 1.300,00 no PIX ou R$ 1.380,00 no crédito', null, 'Intramuscular', 'Dor no local');

insert into public.medicamentos_catalogo (id, nome, protecao, doses, valor, observacao) values
  (1, 'Noripurum', 'Reposição de ferro', 'Conforme prescrição', 'R$ 180,00 por aplicação', 'Exige receita médica. Infusão só com agendamento.'),
  (2, 'Vitamina B12', 'Reposição de vitamina B12', 'Conforme prescrição', 'R$ 60,00 por aplicação', 'Exige receita médica.'),
  (3, 'Vitamina D', 'Reposição de vitamina D', 'Conforme prescrição', 'R$ 70,00 por aplicação', 'Exige receita médica.');

insert into public.planos_vacinais (id, nome, faixa_etaria, valores, vacinas_2m, vacinas_3m, vacinas_4m, vacinas_5m, vacinas_6m, vacinas_12m, resumo) values
  (1, 'PLANO EXEMPLO ATENCIOSO', '2 a 6 meses', 'R$ 3.900,00 no PIX ou 10x de R$ 410,00 no crédito', 'Hexa, Pneumocócica 20, Rotavírus', 'Meningocócica B, Meningocócica ACWY', 'Hexa, Pneumocócica 20, Rotavírus', 'Meningocócica B, Meningocócica ACWY', 'Hexa, Pneumocócica 20, Rotavírus, Influenza', null, 'Cobre as vacinas particulares do 1º semestre de vida.'),
  (2, 'PLANO EXEMPLO AMOROSO', '2 a 15 meses', 'R$ 6.200,00 no PIX ou 12x de R$ 545,00 no crédito', 'Hexa, Pneumocócica 20, Rotavírus', 'Meningocócica B, Meningocócica ACWY', 'Hexa, Pneumocócica 20, Rotavírus', 'Meningocócica B, Meningocócica ACWY', 'Hexa, Pneumocócica 20, Rotavírus, Influenza', 'Varicela, Meningocócica ACWY, Pneumocócica 20', 'Cobre o 1º ano completo, incluindo reforços.');

insert into public.produtos_catalogo (nome, valor, observacao) values
  ('Furo de orelha (brinco)', 'R$ 150,00 o par', 'Inclui o brinco antialérgico.'),
  ('Caderneta de vacinação', 'R$ 25,00', null);

insert into public.esquemas_vacinais (vacina_nome, faixa_etaria, esquema, doses, intervalo_doses, reforco) values
  ('Hexa', 'Bebês', '2, 4 e 6 meses', 3, '60 dias', 'Aos 15 meses'),
  ('Meningocócica B', 'Bebês', '3 e 5 meses', 2, '60 dias', 'Entre 12 e 15 meses'),
  ('HPV9', '9 a 14 anos', '0 e 6 meses', 2, '6 meses', null);

insert into public.horarios_funcionamento (unidade, dia_semana, aberto, hora_abertura, hora_fechamento, intervalo_inicio, intervalo_fim, observacao) values
  ('Clínica Exemplo - Centro', 0, false, null, null, null, null, null),
  ('Clínica Exemplo - Centro', 1, true, '08:00', '18:00', null, null, 'Ordem de chegada'),
  ('Clínica Exemplo - Centro', 2, true, '08:00', '18:00', null, null, 'Ordem de chegada'),
  ('Clínica Exemplo - Centro', 3, true, '08:00', '18:00', null, null, 'Ordem de chegada'),
  ('Clínica Exemplo - Centro', 4, true, '08:00', '18:00', null, null, 'Ordem de chegada'),
  ('Clínica Exemplo - Centro', 5, true, '08:00', '18:00', null, null, 'Ordem de chegada'),
  ('Clínica Exemplo - Centro', 6, true, '08:00', '12:00', null, null, 'Somente com agendamento (repassar para a equipe)');

insert into public.feriados (data, descricao, unidade, aberto) values
  ('2026-11-02', 'Finados', 'todas', false),
  ('2026-11-15', 'Proclamação da República', 'todas', false),
  ('2026-11-20', 'Dia da Consciência Negra', 'todas', false),
  ('2026-12-25', 'Natal', 'todas', false),
  ('2027-01-01', 'Confraternização Universal', 'todas', false);

insert into public.homecare_taxas (bairro, taxa, regiao) values
  ('Centro', 40.00, 'Central'),
  ('Jardim América', 55.00, 'Sul'),
  ('Vila Nova', 55.00, 'Norte'),
  ('Santa Efigênia', 45.00, 'Leste'),
  ('Bela Vista', 65.00, 'Oeste'),
  ('Distrito Industrial', 100.00, 'Fora da região');

insert into public.negotiation_rules (situacao, gatilho, desconto, resposta_modelo, ordem) values
  ('desconto_generico', 'Cliente pergunta se tem desconto sem motivo específico', 'Nenhum além do PIX', 'O melhor valor é no PIX, que já tem desconto em relação ao cartão.', 1),
  ('concorrente_mais_barato', 'Cliente diz que outra clínica cobra menos', '5% no PIX', 'Conseguimos 5% de desconto no PIX para essa vacina.', 2),
  ('irmaos_mesmo_dia', 'Dois ou mais irmãos vacinando no mesmo dia', '5% no total', 'Para irmãos vacinando no mesmo dia, damos 5% no total.', 3);

insert into public.documents (content, metadata) values
  ('Pode aplicar mais de uma vacina no mesmo dia? Sim. A maioria das vacinas pode ser aplicada no mesmo dia, em locais diferentes do corpo, conforme o calendário.', '{"categoria": "aplicacao"}'),
  ('A vacina dá reação? Reações leves como dor no local e febre baixa são comuns e passam em 1 a 2 dias. Reações fortes devem ser avaliadas por um médico.', '{"categoria": "reacoes"}'),
  ('Pode vacinar com febre? Com febre acima de 37,8 °C é melhor adiar a vacina até a febre passar. Resfriado leve sem febre não impede.', '{"categoria": "contraindicacao"}'),
  ('Quais as formas de pagamento? PIX, cartão de crédito, cartão de débito e dinheiro. O PIX tem o melhor valor.', '{"categoria": "pagamento"}'),
  ('Precisa agendar? De segunda a sexta o atendimento é por ordem de chegada. Sábado e home care só com agendamento pela equipe.', '{"categoria": "agendamento"}'),
  ('Como funciona o home care? Uma enfermeira vai até a casa do paciente. É cobrada uma taxa de deslocamento que depende do bairro, além do valor das vacinas.', '{"categoria": "homecare"}'),
  ('A clínica tem diferenciais para crianças? Sim: espaço kids, aplicação com técnicas para reduzir a dor e certificado de coragem.', '{"categoria": "diferenciais"}');
