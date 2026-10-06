const STORAGE_KEY = "feria_universitaria_ventas_v2";
const OLD_STORAGE_KEY = "feria_universitaria_ventas_v1";

const form = document.getElementById("ventaForm");
const productoInput = document.getElementById("producto");
const cantidadInput = document.getElementById("cantidad");
const precioInput = document.getElementById("precio");
const addProductBtn = document.getElementById("addProductBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const imagenInput = document.getElementById("imagen");
const observacionInput = document.getElementById("observacion");
const autoRegisterInput = document.getElementById("autoRegister");
const registerSaleBtn = document.getElementById("registerSaleBtn");

const subtotalPreview = document.getElementById("subtotalPreview");
const cartEmpty = document.getElementById("cartEmpty");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const imagePreviewWrapper = document.getElementById("imagePreviewWrapper");
const imagePreview = document.getElementById("imagePreview");
const removeImageBtn = document.getElementById("removeImageBtn");

const aiStatusBadge = document.getElementById("aiStatusBadge");
const aiProgressWrapper = document.getElementById("aiProgressWrapper");
const aiProgressText = document.getElementById("aiProgressText");
const aiProgressPercent = document.getElementById("aiProgressPercent");
const aiProgressBar = document.getElementById("aiProgressBar");
const aiResult = document.getElementById("aiResult");
const aiConfidence = document.getElementById("aiConfidence");
const aiSummary = document.getElementById("aiSummary");
const aiRawText = document.getElementById("aiRawText");

const emptyState = document.getElementById("emptyState");
const tableWrapper = document.getElementById("tableWrapper");
const ventasBody = document.getElementById("ventasBody");
const clearAllBtn = document.getElementById("clearAllBtn");

const totalRecaudado = document.getElementById("totalRecaudado");
const productoMasVendido = document.getElementById("productoMasVendido");
const numeroTransacciones = document.getElementById("numeroTransacciones");
const unidadesVendidas = document.getElementById("unidadesVendidas");

const toast = document.getElementById("toast");
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeModalBtn = document.getElementById("closeModalBtn");

let ventas = cargarVentas();
let carrito = [];
let imagenTemporal = "";
let analizandoFactura = false;
let ultimoTextoOCR = "";
let ultimaConfianzaOCR = 0;

function generarId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function cargarVentas() {
  try {
    const nuevas = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(nuevas)) return nuevas;

    const antiguas = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    if (!Array.isArray(antiguas)) return [];

    const migradas = antiguas.map((venta) => ({
      id: venta.id || generarId(),
      items: [{
        id: generarId(),
        producto: venta.producto,
        cantidad: Number(venta.cantidad) || 1,
        precio: Number(venta.precio) || 0,
        subtotal: Number(venta.total) || (Number(venta.cantidad) * Number(venta.precio)) || 0,
      }],
      total: Number(venta.total) || 0,
      imagen: venta.imagen || "",
      observacion: venta.observacion || "",
      origen: "Manual",
      fecha: venta.fecha || new Date().toISOString(),
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(migradas));
    return migradas;
  } catch {
    return [];
  }
}

function guardarVentas() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ventas));
}

function moneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

function actualizarSubtotal() {
  const cantidad = Number(cantidadInput.value) || 0;
  const precio = Number(precioInput.value) || 0;
  subtotalPreview.textContent = moneda(cantidad * precio);
}

cantidadInput.addEventListener("input", actualizarSubtotal);
precioInput.addEventListener("input", actualizarSubtotal);

function setError(campo, mensaje) {
  const input = document.getElementById(campo);
  const error = document.getElementById(`${campo}Error`);
  if (input) input.classList.add("input-error");
  if (error) error.textContent = mensaje;
}

function clearError(campo) {
  const input = document.getElementById(campo);
  const error = document.getElementById(`${campo}Error`);
  if (input) input.classList.remove("input-error");
  if (error) error.textContent = "";
}

function validarProducto() {
  ["producto", "cantidad", "precio"].forEach(clearError);
  let valido = true;

  const producto = productoInput.value.trim();
  const cantidad = Number(cantidadInput.value);
  const precio = Number(precioInput.value);

  if (!producto) {
    setError("producto", "Escribe el nombre del producto.");
    valido = false;
  }

  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    setError("cantidad", "La cantidad debe ser un entero mayor que 0.");
    valido = false;
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    setError("precio", "El precio debe ser mayor que 0.");
    valido = false;
  }

  return valido;
}

addProductBtn.addEventListener("click", agregarProducto);

[productoInput, cantidadInput, precioInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      agregarProducto();
    }
  });
});

function agregarProducto() {
  if (!validarProducto()) {
    mostrarToast("Revisa los datos del producto.");
    return;
  }

  agregarItemAlCarrito({
    producto: productoInput.value.trim(),
    cantidad: Number(cantidadInput.value),
    precio: Number(precioInput.value),
  });

  productoInput.value = "";
  cantidadInput.value = "";
  precioInput.value = "";
  subtotalPreview.textContent = moneda(0);
  document.getElementById("ventaError").textContent = "";
  renderCarrito();

  mostrarToast("Producto agregado a la venta.");
  productoInput.focus();
}

function agregarItemAlCarrito({ producto, cantidad, precio }) {
  const nombre = String(producto || "").trim();
  const qty = Number(cantidad);
  const unitPrice = Number(precio);

  if (!nombre || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return false;
  }

  const clave = nombre.toLowerCase();
  const existente = carrito.find(
    (item) => item.producto.toLowerCase() === clave && item.precio === unitPrice
  );

  if (existente) {
    existente.cantidad += qty;
    existente.subtotal = existente.cantidad * existente.precio;
  } else {
    carrito.push({
      id: generarId(),
      producto: nombre,
      cantidad: qty,
      precio: unitPrice,
      subtotal: qty * unitPrice,
    });
  }

  return true;
}

function renderCarrito() {
  cartItems.innerHTML = "";

  const cantidadLineas = carrito.length;
  const unidades = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const total = carrito.reduce((acc, item) => acc + item.subtotal, 0);

  cartCount.textContent =
    `${cantidadLineas} ${cantidadLineas === 1 ? "producto" : "productos"} · ` +
    `${unidades} ${unidades === 1 ? "unidad" : "unidades"}`;

  cartTotal.textContent = moneda(total);
  clearCartBtn.disabled = carrito.length === 0;

  if (carrito.length === 0) {
    cartEmpty.classList.remove("hidden");
    cartItems.classList.add("hidden");
    return;
  }

  cartEmpty.classList.add("hidden");
  cartItems.classList.remove("hidden");

  carrito.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-main">
        <strong>${escapeHtml(item.producto)}</strong>
        <span>${item.cantidad} × ${moneda(item.precio)}</span>
      </div>
      <strong class="cart-item-total">${moneda(item.subtotal)}</strong>
      <button class="delete-btn" type="button" data-remove-cart="${item.id}">Quitar</button>
    `;
    cartItems.appendChild(row);
  });
}

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-cart]");
  if (!button) return;

  carrito = carrito.filter((item) => item.id !== button.dataset.removeCart);
  renderCarrito();
});

clearCartBtn.addEventListener("click", () => {
  if (carrito.length === 0) return;
  if (!confirm("¿Vaciar todos los productos de esta venta?")) return;

  carrito = [];
  renderCarrito();
});

imagenInput.addEventListener("change", async () => {
  const archivo = imagenInput.files[0];

  if (!archivo) {
    limpiarImagen();
    return;
  }

  if (!archivo.type.startsWith("image/")) {
    setError("imagen", "Selecciona un archivo de imagen válido.");
    limpiarImagen(false);
    return;
  }

  if (archivo.size > 10 * 1024 * 1024) {
    setError("imagen", "La imagen debe pesar menos de 10 MB.");
    limpiarImagen(false);
    return;
  }

  clearError("imagen");

  try {
    imagenTemporal = await comprimirImagen(archivo);
    imagePreview.src = imagenTemporal;
    imagePreviewWrapper.classList.remove("hidden");
  } catch {
    setError("imagen", "No se pudo preparar la imagen.");
    return;
  }

  await analizarFacturaConIA(archivo);
});

removeImageBtn.addEventListener("click", () => limpiarImagen());

function limpiarImagen(limpiarError = true) {
  imagenTemporal = "";
  imagenInput.value = "";
  imagePreview.src = "";
  imagePreviewWrapper.classList.add("hidden");

  ultimoTextoOCR = "";
  ultimaConfianzaOCR = 0;
  resetAI();

  if (limpiarError) clearError("imagen");
}

function comprimirImagen(archivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();

      img.onerror = reject;
      img.onload = () => {
        const maxDimension = 1400;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          const scale = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(archivo);
  });
}

async function analizarFacturaConIA(archivo) {
  if (analizandoFactura) return;

  if (!window.Tesseract) {
    setAIStatus("error", "IA no disponible");
    aiResult.classList.remove("hidden");
    aiSummary.textContent =
      "No se pudo cargar el módulo de OCR. Verifica que tengas conexión a Internet y vuelve a cargar la página.";
    return;
  }

  analizandoFactura = true;
  bloquearDuranteIA(true);
  resetAI();

  setAIStatus("loading", "Analizando");
  aiProgressWrapper.classList.remove("hidden");
  actualizarProgresoIA("Preparando motor OCR...", 2);

  try {
    const result = await Tesseract.recognize(archivo, "spa", {
      logger: (message) => {
        const progress = Math.round((message.progress || 0) * 100);
        const label = traducirEstadoOCR(message.status);
        actualizarProgresoIA(label, progress);
      },
    });

    const texto = result?.data?.text || "";
    const confianza = Math.round(result?.data?.confidence || 0);

    ultimoTextoOCR = texto;
    ultimaConfianzaOCR = confianza;

    const productosDetectados = extraerProductosDesdeTexto(texto);

    aiRawText.textContent = texto || "No se reconoció texto.";
    aiConfidence.textContent = `Confianza OCR: ${confianza}%`;
    aiResult.classList.remove("hidden");
    aiProgressWrapper.classList.add("hidden");

    if (productosDetectados.length === 0) {
      setAIStatus("warning", "Revisión necesaria");
      aiSummary.textContent =
        "La IA leyó la imagen, pero no pudo identificar productos con suficiente claridad. Puedes completar la venta manualmente.";
      mostrarToast("La factura fue leída, pero no se detectaron productos.");
      return;
    }

    // Si ya había productos manuales, no se borran; se fusionan con los detectados.
    productosDetectados.forEach(agregarItemAlCarrito);
    renderCarrito();

    const unidades = productosDetectados.reduce((acc, item) => acc + item.cantidad, 0);
    const totalDetectado = productosDetectados.reduce(
      (acc, item) => acc + item.cantidad * item.precio,
      0
    );

    aiSummary.textContent =
      `Se detectaron ${productosDetectados.length} productos, ${unidades} unidades ` +
      `y un total estimado de ${moneda(totalDetectado)}. Revisa los datos si la foto no era clara.`;

    setAIStatus(confianza >= 50 ? "success" : "warning", confianza >= 50 ? "Datos detectados" : "Revisar datos");

    if (autoRegisterInput.checked && confianza >= 50) {
      observacionInput.value =
        observacionInput.value.trim() ||
        "Venta registrada automáticamente mediante lectura OCR/IA.";

      registrarVentaActual({ automatica: true });
    } else {
      mostrarToast("La IA agregó los productos detectados.");
    }
  } catch (error) {
    console.error(error);

    aiProgressWrapper.classList.add("hidden");
    aiResult.classList.remove("hidden");
    aiRawText.textContent = "";

    setAIStatus("error", "Error de lectura");
    aiSummary.textContent =
      "No se pudo analizar la factura. Puedes registrar los productos manualmente o intentar con una foto más nítida.";

    mostrarToast("No se pudo analizar la factura.");
  } finally {
    analizandoFactura = false;
    bloquearDuranteIA(false);
  }
}

function traducirEstadoOCR(status) {
  const estados = {
    "loading tesseract core": "Cargando motor de IA...",
    "initializing tesseract": "Inicializando OCR...",
    "loading language traineddata": "Cargando idioma español...",
    "initializing api": "Preparando reconocimiento...",
    "recognizing text": "Leyendo texto de la factura...",
  };

  return estados[status] || "Analizando factura...";
}

function actualizarProgresoIA(texto, porcentaje) {
  const value = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  aiProgressText.textContent = texto;
  aiProgressPercent.textContent = `${value}%`;
  aiProgressBar.style.width = `${value}%`;
}

function setAIStatus(tipo, texto) {
  aiStatusBadge.className = `status-badge status-${tipo}`;
  aiStatusBadge.textContent = texto;
}

function resetAI() {
  aiResult.classList.add("hidden");
  aiProgressWrapper.classList.add("hidden");
  aiProgressBar.style.width = "0%";
  aiProgressPercent.textContent = "0%";
  aiProgressText.textContent = "Preparando análisis...";
  aiSummary.textContent = "";
  aiConfidence.textContent = "Confianza: --";
  aiRawText.textContent = "";
  setAIStatus("idle", "Esperando imagen");
}

function bloquearDuranteIA(bloqueado) {
  imagenInput.disabled = bloqueado;
  addProductBtn.disabled = bloqueado;
  registerSaleBtn.disabled = bloqueado;
}

function extraerProductosDesdeTexto(texto) {
  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map((linea) => linea.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const productos = [];

  for (const lineaOriginal of lineas) {
    const linea = lineaOriginal
      .replace(/[|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!linea || esLineaNoProducto(linea)) continue;

    let match;
    let producto = "";
    let cantidad = 1;
    let precio = 0;

    // Ejemplo: EMPANADA 2 x 5000
    match = linea.match(/^(.{2,50}?)\s+(\d{1,3})\s*[xX]\s*\$?\s*([\d.,]{3,})/);
    if (match) {
      producto = limpiarNombreProducto(match[1]);
      cantidad = Number(match[2]);
      precio = normalizarDinero(match[3]);
    }

    // Ejemplo: 2 x 5000 EMPANADA
    if (!precio) {
      match = linea.match(/^(\d{1,3})\s*[xX]\s*\$?\s*([\d.,]{3,})\s+(.{2,50})$/);
      if (match) {
        cantidad = Number(match[1]);
        precio = normalizarDinero(match[2]);
        producto = limpiarNombreProducto(match[3]);
      }
    }

    // Ejemplo: EMPANADA 2 5000 10000
    if (!precio) {
      match = linea.match(/^(.{2,50}?)\s+(\d{1,3})\s+\$?\s*([\d.,]{3,})(?:\s+\$?\s*[\d.,]{3,})?$/);
      if (match) {
        producto = limpiarNombreProducto(match[1]);
        cantidad = Number(match[2]);
        precio = normalizarDinero(match[3]);
      }
    }

    // Ejemplo: EMPANADA $5000  (cantidad = 1)
    if (!precio) {
      match = linea.match(/^(.{2,50}?)\s+\$?\s*([\d.,]{3,})$/);
      if (match) {
        producto = limpiarNombreProducto(match[1]);
        cantidad = 1;
        precio = normalizarDinero(match[2]);
      }
    }

    if (
      producto &&
      producto.length >= 2 &&
      cantidad > 0 &&
      cantidad <= 999 &&
      precio >= 100 &&
      precio <= 100000000 &&
      !esNombreNoProducto(producto)
    ) {
      productos.push({
        producto,
        cantidad,
        precio,
      });
    }
  }

  return deduplicarProductos(productos);
}

function esLineaNoProducto(linea) {
  const lower = linea.toLowerCase();

  const palabrasIgnorar = [
    "total",
    "subtotal",
    "iva",
    "impuesto",
    "cambio",
    "efectivo",
    "tarjeta",
    "pago",
    "recibo",
    "factura",
    "fecha",
    "hora",
    "nit",
    "n.i.t",
    "cliente",
    "cajero",
    "vendedor",
    "direccion",
    "dirección",
    "telefono",
    "teléfono",
    "tel ",
    "gracias",
    "universidad",
    "transaccion",
    "transacción",
    "documento",
    "resolucion",
    "resolución",
    "mesa",
    "orden",
    "propina",
    "descuento",
    "rete",
  ];

  return palabrasIgnorar.some((palabra) => lower.includes(palabra));
}

function esNombreNoProducto(nombre) {
  const lower = nombre.toLowerCase();

  if (/^\d+$/.test(lower)) return true;
  if (lower.length < 2) return true;

  return ["und", "unidad", "cant", "cantidad", "precio", "valor"].includes(lower);
}

function limpiarNombreProducto(nombre) {
  return String(nombre || "")
    .replace(/^[#*:\-.\s]+/, "")
    .replace(/\b(und|unds|unidad|unidades|u)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[-:.,]+$/, "")
    .trim();
}

function normalizarDinero(valor) {
  let texto = String(valor || "").replace(/[^\d.,]/g, "");

  // 5000,00 -> 5000
  if (/,\d{2}$/.test(texto)) {
    texto = texto.replace(/,\d{2}$/, "");
  } else if (/\.\d{2}$/.test(texto) && !/\.\d{3}$/.test(texto)) {
    texto = texto.replace(/\.\d{2}$/, "");
  }

  texto = texto.replace(/[.,]/g, "");
  return Number(texto) || 0;
}

function deduplicarProductos(productos) {
  const mapa = new Map();

  for (const item of productos) {
    const clave = `${item.producto.toLowerCase()}|${item.precio}`;

    if (mapa.has(clave)) {
      mapa.get(clave).cantidad += item.cantidad;
    } else {
      mapa.set(clave, { ...item });
    }
  }

  return [...mapa.values()].slice(0, 30);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  registrarVentaActual({ automatica: false });
});

function registrarVentaActual({ automatica = false } = {}) {
  const ventaError = document.getElementById("ventaError");
  ventaError.textContent = "";

  if (carrito.length === 0) {
    ventaError.textContent = "Agrega al menos un producto antes de registrar la venta.";

    if (!automatica) {
      mostrarToast("La venta no tiene productos.");
      productoInput.focus();
    }

    return false;
  }

  const total = carrito.reduce((acc, item) => acc + item.subtotal, 0);

  const venta = {
    id: generarId(),
    items: carrito.map((item) => ({ ...item })),
    total,
    imagen: imagenTemporal,
    observacion: observacionInput.value.trim(),
    origen: automatica ? "IA/OCR" : "Manual",
    confianzaOCR: automatica ? ultimaConfianzaOCR : null,
    textoOCR: automatica ? ultimoTextoOCR.slice(0, 3000) : "",
    fecha: new Date().toISOString(),
  };

  ventas.unshift(venta);

  try {
    guardarVentas();
  } catch {
    ventas.shift();
    mostrarToast("No se pudo guardar. Prueba con una imagen más liviana.");
    return false;
  }

  carrito = [];
  form.reset();

  // Después de form.reset(), se conserva la preferencia de autorregistro activa.
  autoRegisterInput.checked = true;

  limpiarImagen();
  renderCarrito();
  render();

  mostrarToast(
    automatica
      ? "Factura leída y venta registrada automáticamente."
      : "Venta completa registrada correctamente."
  );

  return true;
}

function render() {
  renderTabla();
  renderResumen();
}

function renderTabla() {
  ventasBody.innerHTML = "";

  if (ventas.length === 0) {
    emptyState.classList.remove("hidden");
    tableWrapper.classList.add("hidden");
    clearAllBtn.disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  tableWrapper.classList.remove("hidden");
  clearAllBtn.disabled = false;

  ventas.forEach((venta, index) => {
    const fecha = new Date(venta.fecha);
    const items = Array.isArray(venta.items) ? venta.items : [];
    const unidades = items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);

    const productosHtml = items
      .map(
        (item) => `
          <div class="sale-product-line">
            <strong>${escapeHtml(item.producto)}</strong>
            <span>${item.cantidad} × ${moneda(item.precio)} = ${moneda(item.subtotal)}</span>
          </div>
        `
      )
      .join("");

    const origen = venta.origen || "Manual";
    const origenClass = origen === "IA/OCR" ? "origin-ai" : "origin-manual";

    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${ventas.length - index}</td>
      <td class="products-cell">
        ${productosHtml}
        ${
          venta.observacion
            ? `<small class="sale-note">Nota: ${escapeHtml(venta.observacion)}</small>`
            : ""
        }
      </td>
      <td>${unidades}</td>
      <td><strong>${moneda(venta.total)}</strong></td>
      <td>
        <span class="origin-badge ${origenClass}">${escapeHtml(origen)}</span>
        ${
          venta.confianzaOCR
            ? `<small>${venta.confianzaOCR}% confianza</small>`
            : ""
        }
      </td>
      <td>${fecha.toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}</td>
      <td>
        ${
          venta.imagen
            ? `<button class="thumb-btn" data-view-image="${venta.id}" title="Ver comprobante">
                 <img class="thumb" src="${venta.imagen}" alt="Comprobante de la venta">
               </button>`
            : `<span class="no-image">Sin imagen</span>`
        }
      </td>
      <td>
        <button class="delete-btn" data-delete="${venta.id}">Eliminar</button>
      </td>
    `;

    ventasBody.appendChild(fila);
  });
}

function renderResumen() {
  const total = ventas.reduce((acc, venta) => acc + Number(venta.total || 0), 0);

  const todosLosItems = ventas.flatMap((venta) =>
    Array.isArray(venta.items) ? venta.items : []
  );

  const unidades = todosLosItems.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  const conteoProductos = {};

  todosLosItems.forEach((item) => {
    const clave = String(item.producto || "").trim().toLowerCase();
    if (!clave) return;

    if (!conteoProductos[clave]) {
      conteoProductos[clave] = {
        nombre: item.producto,
        cantidad: 0,
      };
    }

    conteoProductos[clave].cantidad += Number(item.cantidad || 0);
  });

  const masVendido = Object.values(conteoProductos).sort(
    (a, b) => b.cantidad - a.cantidad
  )[0];

  totalRecaudado.textContent = moneda(total);
  numeroTransacciones.textContent = ventas.length;
  unidadesVendidas.textContent = unidades;
  productoMasVendido.textContent = masVendido
    ? `${masVendido.nombre} (${masVendido.cantidad})`
    : "Sin datos";
}

ventasBody.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete]");
  const imageButton = event.target.closest("[data-view-image]");

  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const venta = ventas.find((item) => item.id === id);

    if (!venta) return;
    if (!confirm("¿Eliminar esta venta completa y todos sus productos?")) return;

    ventas = ventas.filter((item) => item.id !== id);
    guardarVentas();
    render();

    mostrarToast("Venta eliminada.");
  }

  if (imageButton) {
    const venta = ventas.find(
      (item) => item.id === imageButton.dataset.viewImage
    );

    if (venta?.imagen) {
      modalImage.src = venta.imagen;
      imageModal.classList.remove("hidden");
      imageModal.setAttribute("aria-hidden", "false");
    }
  }
});

clearAllBtn.addEventListener("click", () => {
  if (ventas.length === 0) return;

  if (!confirm("¿Seguro que deseas eliminar todas las ventas registradas?")) {
    return;
  }

  ventas = [];
  guardarVentas();
  render();

  mostrarToast("Se eliminaron todas las ventas.");
});

closeModalBtn.addEventListener("click", cerrarModal);

imageModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-modal")) {
    cerrarModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !imageModal.classList.contains("hidden")
  ) {
    cerrarModal();
  }
});

function cerrarModal() {
  imageModal.classList.add("hidden");
  imageModal.setAttribute("aria-hidden", "true");
  modalImage.src = "";
}

let toastTimer;

function mostrarToast(mensaje) {
  toast.textContent = mensaje;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

renderCarrito();
render();
