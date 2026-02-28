Excelente ideia para um hackathon! O escopo é claro, resolve um problema real e tem um fator "Uau" com a IA (que os jurados adoram). 

Para um hackathon de **8 horas**, a regra de ouro é: **não construa o que você pode "roubar" (usar APIs prontas)**. Não tente usar uma biblioteca de OCR tradicional (como Tesseract) e depois jogar para a IA. **Use um LLM Multimodal (GPT-4o Vision ou Gemini 1.5 Pro/Flash)**. Você manda a imagem da nota e um prompt, e ele te devolve um JSON perfeito, já deduplicado.

Aqui está o plano de ataque focado em extração de valor e velocidade.

---

### 💡 1. Extração Principal de Valor (O Pitch)
Não venda como "um app que lê notas fiscais". Venda como **"O seu gestor financeiro de suprimentos focado em ROI"**. 
A extração de valor é: **"Pessoas e pequenas empresas perdem X% do orçamento comprando a varejo o que deveriam comprar no atacado. Nosso app transforma papel amassado em inteligência de compras instantânea."**

O fato de ser **Global** entra na IA: não importa o idioma ou a moeda da nota, a IA entende, normaliza para o idioma do usuário e categoriza.

---

### 🚶‍♂️ 2. Fluxos de Usuário (Otimizados para 8 horas)

*Dica de Hackathon: Faça o fluxo feliz. Não perca tempo com recuperação de senha ou edição de perfil.*

**Fluxo 1: Envio "Mágico" (Upload)**
1. Usuário clica num botão gigante "Escanear Nota".
2. Tira a foto (ou faz upload).
3. **A Mágica:** Um loading na tela enquanto a imagem vai para a API da OpenAI/Google. A IA lê, extrai, traduz (se necessário) e já gera o campo `normalizedName` (ex: "Leite Italac 1L" vira "Leite Integral").
4. Retorna sucesso e vai pro Dashboard.

**Fluxo 2: Dashboard (O panorama global)**
1. Card com Gasto Total do mês atual.
2. Gráfico simples de barras (gastos por semana).
3. **Seção "Dinheiro na Mesa" (Alertas da IA):** Cards gerados dinamicamente indicando produtos que estão drenando dinheiro no varejo.

**Fluxo 3: Visão do Produto & Insight de Atacado**
1. O usuário clica em "Leite Integral" (agrupamento de Italac, Itambé, etc).
2. Vê que comprou 12 litros no mês, pingado (2 hoje, 3 amanhã), pagando média de R$ 5,00/L.
3. **O Insight Final:** A tela mostra a sugestão da IA: *"Você consome ~12L/mês. Se comprar um fardo de 12L no atacado por R$ 45,00 (R$ 3,75/L), você economiza R$ 15,00/mês ou R$ 180/ano."*

---

### 🗄️ 3. Schema Prisma (Super Simples e Estratégico)

Para 8 horas, **não crie dezenas de tabelas relacionais complexas**. Use um modelo mais "flat". O segredo aqui é o campo `normalizedName` no Item. É ele que fará o agrupamento (o leite Italac e Itambé terão o mesmo `normalizedName` gerado pela IA na hora do upload).

---

### 🚀 Dica de Ouro para Execução nas 8 Horas: O Prompt da IA

Você vai perder muito tempo se tentar fazer OCR e depois classificar. Faça tudo em 1 chamada de API. 

Mande a imagem para o `gpt-4o` (ou `gemini-1.5-flash` que é rápido e barato) com este prompt do sistema (System Prompt):

> "Você é um extrator de dados de notas fiscais globais. Vou te enviar uma imagem de um recibo. Extraia os dados e retorne ESTRITAMENTE um JSON neste formato:
> `{ "date": "YYYY-MM-DD", "totalAmount": 150.50, "currency": "BRL", "items": [ { "rawName": "Nome exato na nota", "normalizedName": "Nome genérico do produto para agrupamento em português (ex: Leite Integral, Papel Higiênico)", "category": "Categoria ampla", "quantity": 2, "unitPrice": 5.00, "totalPrice": 10.00 } ] }`.
> Agrupe marcas diferentes sob o mesmo 'normalizedName'."

**Como gerar os Insights do Fluxo 3 na hora?**
No backend, quando o usuário abrir a tela do produto "Leite Integral", faça uma query agregando todo o histórico de compras desse `normalizedName`. Pegue o consumo médio mensal e mande para a IA perguntando: *"O usuário consome X quantidade disso por mês gastando Y. Dê uma dica curta e direta se vale a pena comprar no atacado e estime a economia em JSON."*

Boa sorte no Hackathon! Foca no frontend bonito e no prompt bem feito que o troféu vem. Se precisar de ajuda com a stack (Next.js, Tailwind, etc), me avise!