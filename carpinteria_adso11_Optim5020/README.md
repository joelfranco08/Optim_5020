<<<<<<< HEAD
# OptimAl 5020 – Sistema de Corte y Despiece

## Estructura del Proyecto

```
optimal5020/
├── app.py                  # Servidor Flask (API + rutas)
├── optimizador.py          # Motor de despiece 5020 + algoritmo FFD
├── requirements.txt        # Dependencias Python
├── templates/
│   └── index.html          # Plantilla Jinja2 (HTML puro, sin CSS ni JS inline)
└── static/
    ├── css/
    │   └── main.css        # Estilos de la aplicación
    └── js/
        └── app.js          # Lógica frontend (SVG, API, UI)
```

## Instalación y Arranque

```bash
pip install -r requirements.txt
python app.py
```

Abre `http://localhost:5000` en tu navegador.

## API

`POST /api/optimizar`
```json
{ "ancho_mm": 1200, "alto_mm": 1000 }
```

### Respuesta exitosa (200)
```json
{
  "dimensiones": { "ancho_mm": 1200, "alto_mm": 1000 },
  "piezas": [...],
  "barras": [...],
  "resumen": {
    "total_barras_usadas": 3,
    "eficiencia_porcentaje": 87.5,
    ...
  }
}
```

## Variables de entorno

| Variable      | Default | Descripción                        |
|---------------|---------|------------------------------------|
| `PORT`        | `5000`  | Puerto del servidor Flask          |
| `FLASK_DEBUG` | `false` | Activa el modo debug de Flask      |
| `CORS_ORIGIN` | `*`     | Origen permitido para CORS         |
=======
# Optim_5020
proyecto de desarrollo de feria de adso 11
>>>>>>> ea6ee59c444bc3f5da079ff5f8f323af93dd89e1
