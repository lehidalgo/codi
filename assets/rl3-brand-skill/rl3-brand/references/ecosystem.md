# RL3 — Ecosistema Tecnológico y Casos de Uso

## Table of Contents
1. [Análisis Regional](#análisis-regional)
2. [Catálogo Completo de Casos de Uso](#catálogo-completo-de-casos-de-uso)
3. [Bloques Lego de Plataforma](#bloques-lego-de-plataforma)

---

## Análisis Regional

### España (UE)
- **Motor**: Alivio burocrático + cumplimiento normativo
- **Regulación**: GDPR + EU AI Act + Registro Horario + Kit Digital
- **Idioma**: Español obligatorio; Catalán/Euskera = diferenciador
- **Stack**: Holded, Sage, A3, WhatsApp Business
- **Compra**: Averso al riesgo; subvenciones (Kit Digital 2k-12k); confianza local; prefieren precio fijo
- **Verticales**: Turismo, Manufactura, Admin Pública, AgriTech
- **Top Use Cases**: Cumplimiento Facturación (#9), RAG Conocimiento (#4), Facturas Proveedores (#6)

### EAU (Emiratos Árabes Unidos)
- **Motor**: Velocidad + escala + digitalización gubernamental
- **Regulación**: PDPL + Leyes DIFC + Gobierno Pro-IA + Residencia Datos
- **Idioma**: Inglés comercial; Árabe = clave para Gobierno
- **Stack**: Zoho, Odoo, MS Dynamics, WhatsApp
- **Compra**: Basado en relaciones; vistoso+funcional; Visión 2031; servicio VIP; prefieren mensual
- **Verticales**: Inmobiliaria, Logística/Comercio, FinTech, GovTech
- **Top Use Cases**: Comercio WhatsApp (#5), Cualificación Leads (#3), Hostelería (#17)

### Estados Unidos
- **Motor**: Reducción costes laborales + responsabilidad legal
- **Regulación**: HIPAA + CCPA + TCPA + Leyes estatales fragmentadas
- **Idioma**: Inglés dominante; Español deseable
- **Stack**: HubSpot, QuickBooks, Slack, M365, G-Suite
- **Compra**: Obsesionado con ROI; transaccional; "ahorra = compra hoy"
- **Verticales**: Salud, SaaS, Servicios Profesionales, Retail
- **Top Use Cases**: Cobros Morosidad (#1), Triaje Soporte (#2), Triaje Ciber (#8)

---

## Catálogo Completo de Casos de Uso

### Nivel TOP (Puntuación ≥ 7.0)
| # | Nombre Corto | Categoría | Patrón IA | Precio | Semanas |
|---|---|---|---|---|---|
| 1 | Copiloto de Cobros | Protección Ingresos | Agente + Auto + Predictivo | 12k-90k | 4-8 |
| 2 | Agente Triaje Soporte | Auto. Soporte | Agente + RAG + Auto | 15k-120k | 2-6 |
| 3 | Agente Cualificación Leads | Ventas y Marketing | Agente + Auto | 15k-110k | 4-8 |
| 4 | Copiloto RAG Conocimiento | Ops Internas | Copiloto RAG | 18k-150k | 2-6 |
| 5 | Agente WhatsApp Commerce | Auto. Soporte | Agente + Auto + RAG | 15k-90k | 4-8 |
| 6 | Automatización Facturas | Auto. Back-Office | Auto + Doc AI + Copiloto | 12k-80k | 4-8 |

### Nivel ALTO (Puntuación 6.5-7.0)
| # | Nombre Corto | Categoría | Precio | Semanas |
|---|---|---|---|---|
| 7 | Agente Reunión-a-CRM | Ventas y Marketing | 10k-60k | 4-6 |
| 8 | Agente Triaje Ciber | Seguridad y Riesgos | 20k-80k | 6-10 |
| 9 | Compliance Facturación | Auto. Back-Office | 10k-50k | 4-8 |
| 10 | Agente Helpdesk IT | Ops Internas | 15k-60k | 4-8 |
| 11 | Agente Respuesta Reseñas | Auto. Soporte | 8k-30k | 2-4 |

### Nivel MEDIO (Puntuación 5.8-6.5)
| # | Nombre Corto | Categoría | Precio | Semanas |
|---|---|---|---|---|
| 12 | Agente Triaje Devoluciones | Seguridad y Riesgos | 20k-180k | 6-10 |
| 13 | Copiloto Revisión Contratos | Servicios Prof. | 20k-100k | 6-12 |
| 14 | Agente Onboarding RRHH | Ops Internas | 15k-60k | 4-8 |
| 15 | Localización Contenidos | Ventas y Marketing | 10k-50k | 3-6 |
| 16 | Admin Construcción | Ops Campo | 20k-80k | 6-12 |
| 17 | Copiloto Hostelería | Ops Campo | 15k-60k | 4-8 |
| 18 | Asistente Reclutamiento | Ops Internas | 15k-60k | 6-10 |
| 19 | Automatización Fichajes | Auto. Back-Office | 10k-50k | 4-8 |
| 20 | Copiloto Conciliación | Auto. Back-Office | 15k-70k | 6-10 |
| 21 | Previsión Demanda | Predictivo | 25k-100k | 8-14 |

### Nivel BAJO (Puntuación < 5.8)
| # | Nombre Corto | Categoría | Precio | Semanas |
|---|---|---|---|---|
| 22 | Agente Despacho Campo | Ops Campo | 20k-80k | 6-12 |
| 23 | Copiloto Compras | Auto. Back-Office | 15k-60k | 6-10 |
| 24 | Gestor DSAR | Seguridad y Riesgos | 15k-60k | 6-10 |
| 25 | Predictor de Bajas | Predictivo | 20k-80k | 8-14 |

---

## Bloques Lego de Plataforma

### Bloques que EXISTEN en ASP (Agent Serving Platform)
- **B-RT** Runtime Agentes — Google ADK, LangGraph (25 usos)
- **B-MEM** Servicio Memoria — Firestore session memory (14 usos)
- **B-RAG** Motor RAG — Vertex AI RAG, AlloyDB vector (17 usos)
- **B-ING** Ingesta de Datos — Cloud Storage triggers (13 usos)
- **B-A2A** Protocolo Agentes — Google A2A protocol (2 usos)
- **B-API** Capa API — FastAPI + Cloud Run (25 usos)
- **B-OBS** Observabilidad — OpenTelemetry + Cloud Trace/Logging (25 usos)
- **B-EVAL** Evaluación IA — Vertex AI Eval (25 usos)

### Bloques PARCIALES
- **B-TR** Registro Tools — ADK ToolRegistry básico (25 usos) → Recomendado: Composio
- **B-PM** Gestor de Prompts — YAML prompt templates (23 usos) → Recomendado: Langfuse
- **B-FE** App Frontend — Mesop básico (25 usos) → Recomendado: assistant-ui / Open WebUI

### Bloques que FALTAN
- **B-MLT** Memoria Largo Plazo → Recomendado: Mem0 (Apache 2.0)
- **B-CRAWL** Web Scraper/Crawler → Recomendado: Crawl4AI + ScrapeGraphAI + Playwright
- **B-AUTH** Servicio Auth → Recomendado: Keycloak + Casbin
- **B-CMS** Gestor Contenido → Recomendado: Payload CMS
- **B-CONN** Hub Conectores → Recomendado: Composio + Nango
- **B-Q** Colas/Workers → Recomendado: Celery / Taskiq
- **B-CACHE** Capa Cache → Recomendado: Valkey + GPTCache
