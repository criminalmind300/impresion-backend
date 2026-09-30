const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const app = express();
const upload = multer({ dest: 'uploads/' });

const COSTO_POR_PAGINA = 5.00; // Ajusta tu tarifa en pesos o dólares
const referenciasProcesadas = new Set();

app.post('/api/procesar-impresion', upload.fields([{ name: 'doc' }, { name: 'comprobante' }]), (req, res) => {
  const paginas = parseInt(req.body.paginas) || 1;
  const costoTotal = paginas * COSTO_POR_PAGINA;
  const comprobantePath = req.files['comprobante'][0].path;
  const docPath = req.files['doc'][0].path;

  exec(`python3 ocr_validator.py --image "${comprobantePath}"`, (error, stdout) => {
    if (error) return res.status(500).json({ status: 'ERROR', message: 'Error procesando OCR en la nube' });
    
    const resultado = JSON.parse(stdout);
    
    if (resultado.imagen_editada) {
      return res.status(400).json({ status: 'RECHAZADO', message: 'Comprobante alterado digitalmente.' });
    }

    if (!resultado.es_fecha_valida) {
      return res.status(400).json({ status: 'RECHAZADO', message: 'El comprobante no corresponde a la fecha de hoy.' });
    }

    const ref = resultado.referencia;
    if (!ref || referenciasProcesadas.has(ref)) {
      return res.status(400).json({ status: 'RECHAZADO', message: 'Referencia inválida o ya utilizada.' });
    }

    const montoPagado = resultado.monto_detectado;

    if (montoPagado >= costoTotal) {
      referenciasProcesadas.add(ref);
      exec(`lp -h 192.168.8.100:631 -d Brother_HL_L5000D "${docPath}"`);
      return res.json({ status: 'COMPLETO', paginasImpresas: paginas, saldoPendiente: 0 });
    } else if (montoPagado > 0) {
      const paginasPermitidas = Math.floor(montoPagado / COSTO_POR_PAGINA);
      const saldoPendiente = costoTotal - montoPagado;
      
      if (paginasPermitidas > 0) {
        referenciasProcesadas.add(ref);
        exec(`lp -h 192.168.8.100:631 -d Brother_HL_L5000D -P 1-${paginasPermitidas} "${docPath}"`);
        return res.json({ status: 'PARCIAL', paginasImpresas: paginasPermitidas, saldoPendiente: saldoPendiente });
      } else {
        return res.status(400).json({ status: 'RECHAZADO', message: 'Monto insuficiente para imprimir.' });
      }
    } else {
      return res.status(400).json({ status: 'RECHAZADO', message: 'No se detectó monto válido.' });
    }
  });
});

app.listen(3000, () => console.log('Servidor backend híbrido corriendo en puerto 3000'));