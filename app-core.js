// URL de tu repositorio en GitHub Pages
const GITHUB_JSON_URL = "https://tu-usuario.github.io/vocabulary-builder/vocabulary.json";

// 1. Extraer Nivel y Unidad del nombre del archivo en la URL de Moodle
function getLevelAndUnitFromURL() {
  const currentURL = window.location.href; // Lee la URL de pluginfile.php en Moodle
  
  // Busca patrones como "Level 1 Unit 1" o "Level%201%20Unit%201"
  const match = currentURL.match(/Level%20(\d+)%20Unit%20(\d+)/i) || 
                currentURL.match(/Level\s*(\d+)\s*Unit\s*(\d+)/i);

  if (match) {
    return { level: match[1], unit: match[2], key: `${match[1]}-${match[2]}` };
  }
  
  // Valores por defecto en caso de no detectar nada (para pruebas locales)
  console.warn("No se detectó Level/Unit en la URL. Usando 1-1 por defecto.");
  return { level: "1", unit: "1", key: "1-1" };
}

let fullVocabulary = [];
let currentVocab = [];

// 2. Cargar el vocabulario desde GitHub Pages
async function initApp() {
  const target = getLevelAndUnitFromURL();
  
  // Actualizar el título en la cabecera
  const badge = document.querySelector('.header-level-badge');
  if (badge) badge.innerText = `📌 Level ${target.level} — Unit ${target.unit}`;

  try {
    const response = await fetch(GITHUB_JSON_URL);
    const data = await response.json();
    
    // Obtener las palabras de la clave "nivel-unidad"
    if (data[target.key]) {
      fullVocabulary = data[target.key];
      currentVocab = [...fullVocabulary];
      
      // Actualizar dinámicamente el selector de categorías
      populateCategories();
      
      // Iniciar la primera tarjeta (Flashcards)
      renderFlashcard();
    } else {
      alert(`⚠️ No se encontró vocabulario configurado para Level ${target.level} Unit ${target.unit} en el archivo JSON.`);
    }
  } catch (error) {
    console.error("Error cargando el vocabulario:", error);
  }
}

function populateCategories() {
  const select = document.getElementById('categorySelect');
  if (!select) return;

  const categories = ["ALL", ...new Set(fullVocabulary.map(item => item.category))];
  select.innerHTML = '';
  
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'ALL' ? 'All Categories' : cat;
    select.appendChild(opt);
  });
}

// Ejecutar al cargar el documento
window.addEventListener('DOMContentLoaded', initApp);
