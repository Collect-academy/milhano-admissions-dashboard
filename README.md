# COLDEM Admissions — Dashboard V1

Dashboard estático listo para desplegar en Vercel. No requiere `npm install` ni proceso de compilación.

## Views incluidas

1. **Resumen** — KPIs, actividad diaria, backlog de fin de semana y pendientes.
2. **Seguimiento** — cola priorizada con registros enmascarados del Excel actual.
3. **Embudo** — conversiones acumuladas, fugas y calidad de datos.
4. **Adquisición** — rendimiento por fuente y motivos de pérdida.
5. **EOD** — captura manual por responsable, historial, exportación CSV y captura rápida de sábado/domingo.

## Datos incluidos

- Agregados y milestones calculados desde `LEADS(1)(1).xlsx`.
- Histórico diario de `KPIs_Diarios`.
- Los nombres, teléfonos y correos no se publican. La tabla de seguimiento usa IDs y nombres enmascarados.

## Probar localmente

Desde esta carpeta:

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`.

## Desplegar en Vercel

1. Sube la carpeta a un repositorio de GitHub.
2. En Vercel selecciona **Add New > Project**.
3. Importa el repositorio.
4. Framework Preset: **Other**.
5. Build Command: vacío.
6. Output Directory: `.`
7. Deploy.

## Hacer el EOD compartido entre Cinthia y Paty

Por defecto, el EOD se guarda en `localStorage`, por lo que funciona únicamente en el navegador donde se captura.

Para compartirlo:

1. Crea un Google Sheet vacío.
2. Ve a **Extensiones > Apps Script**.
3. Copia `apps-script/Code.gs`.
4. Reemplaza `SPREADSHEET_ID` por el ID del Sheet.
5. Ejecuta `setup()` una vez y autoriza.
6. **Implementar > Nueva implementación > Aplicación web**.
7. Ejecutar como: tú. Acceso: cualquier usuario con el enlace.
8. Copia la URL que termina en `/exec`.
9. Pégala en `config.js`:

```js
window.COLDEM_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXX/exec",
  SCHOOL_TIMEZONE: "America/Merida"
};
```

10. Vuelve a desplegar en Vercel.

## Preparación para fase GHL

La capa visual ya separa:

- datos históricos agregados;
- cola de seguimiento;
- EOD manual;
- fuente de persistencia.

En la siguiente fase se puede reemplazar `seed-data.js` por endpoints de GHL sin rediseñar las views.
