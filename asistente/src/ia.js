// Preguntas abiertas con ChatGPT (API de OpenAI). Solo se usa cuando ningún comando local aplica.
const INSTRUCCIONES = `Eres TIVO, un asistente de voz que acompaña a una persona mayor en Colombia.
Tu respuesta se va a leer en voz alta, así que:
- Responde en español, en máximo tres frases cortas y con palabras sencillas.
- Habla con calidez y respeto, tratando de "usted". Sin tecnicismos, listas, símbolos ni emojis.
- Si no sabes algo, dilo con sencillez.
- No des diagnósticos ni cambies dosis de medicamentos: ante dudas de salud, sugiere consultar al médico o a un familiar.
- Si la persona describe una emergencia, dile que llame al 123 o pida ayuda a quien esté cerca.`;

export class AsistenteIA {
  constructor({ clave, modelo, pedir = fetch }) {
    this.clave = clave;
    this.modelo = modelo;
    this.pedir = pedir;
    this.historial = [];
  }

  get disponible() {
    return Boolean(this.clave);
  }

  async preguntar(pregunta, contexto = '') {
    const mensajes = [
      { role: 'system', content: contexto ? `${INSTRUCCIONES}\n\n${contexto}` : INSTRUCCIONES },
      ...this.historial,
      { role: 'user', content: pregunta },
    ];
    const respuesta = await this.pedir('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.clave}` },
      body: JSON.stringify({ model: this.modelo, messages: mensajes, max_completion_tokens: 200 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!respuesta.ok) throw new Error(`OpenAI respondió ${respuesta.status}`);
    const datos = await respuesta.json();
    const texto = datos.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error('OpenAI no devolvió texto');
    // Se recuerdan los últimos tres intercambios para que la conversación tenga hilo.
    this.historial.push({ role: 'user', content: pregunta }, { role: 'assistant', content: texto });
    this.historial = this.historial.slice(-6);
    return texto.replace(/[*_#`]/g, '');
  }
}
