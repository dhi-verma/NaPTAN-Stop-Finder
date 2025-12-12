// ============================================
// NaPTAN Stop Finder - CORS PROXY VERSION
// ============================================

let selectedFromStop = null;
let selectedToStop = null;

const searchInput = document.getElementById('stopSearch');
const searchBtn = document.getElementById('searchBtn');
const searchBtnText = document.getElementById('searchBtnText');
const searchSpinner = document.getElementById('searchSpinner');
const searchResults = document.getElementById('searchResults');
const fromStopInput = document.getElementById('fromStop');
const toStopInput = document.getElementById('toStop');
const calculateBtn = document.getElementById('calculateBtn');
const distanceResults = document.getElementById('distanceResults');

// CORS PROXY - Allows browser access to NaPTAN API
const CORS_PROXY = 'https://corsproxy.io/?';
const NAPTAN_API_BASE = 'https://naptan.api.dft.gov.uk/v1/access-nodes';

/**
 * Search NaPTAN database via CORS proxy
 */
async function searchNaPTANStops(query) {
    console.log('Searching NaPTAN for:', query);
    
    try {
        // Download full CSV and search locally (most reliable method)
        const csvUrl = `${CORS_PROXY}${encodeURIComponent(NAPTAN_API_BASE + '?dataFormat=csv')}`;
        console.log('Fetching CSV from:', csvUrl);
        
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        console.log('CSV data received, length:', csvText.length);
        
        // Parse CSV and filter results
        const stops = parseCSVAndFilter(csvText, query);
        return stops.slice(0, 10); // Return top 10 matches
        
    } catch (error) {
        console.error('API Error:', error);
        throw new Error(`Failed to fetch data: ${error.message}`);
    }
}

/**
 * Parse CSV data and filter by query
 */
function parseCSVAndFilter(csvText, query) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const stops = [];
    const queryLower = query.toLowerCase();
    
    // Find column indexes
    const atcoIndex = headers.indexOf('ATCOCode');
    const nameIndex = headers.indexOf('CommonName');
    const localityIndex = headers.indexOf('LocalityName');
    const latIndex = headers.indexOf('Latitude');
    const lonIndex = headers.indexOf('Longitude');
    const statusIndex = headers.indexOf('Status');
    const stopTypeIndex = headers.indexOf('StopType');
    
    for (let i = 1; i < lines.length && stops.length < 50; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const cols = line.split(',');
        
        const commonName = cols[nameIndex]?.replace(/"/g, '') || '';
        const locality = cols[localityIndex]?.replace(/"/g, '') || '';
        
        // Search in name or locality
        if (commonName.toLowerCase().includes(queryLower) || 
            locality.toLowerCase().includes(queryLower)) {
            
            stops.push({
                ATCOCode: cols[atcoIndex]?.replace(/"/g, '') || 'N/A',
                CommonName: commonName,
                LocalityName: locality,
                StopType: cols[stopTypeIndex]?.replace(/"/g, '') || 'Bus Stop',
                Status: cols[statusIndex]?.replace(/"/g, '') || 'Active',
                Latitude: parseFloat(cols[latIndex]) || 0,
                Longitude: parseFloat(cols[lonIndex]) || 0
            });
        }
    }
    
    return stops;
}

/**
 * Calculate distance using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMiles = R * c;
    const distanceKm = distanceMiles * 1.60934;
    
    return { miles: distanceMiles, km: distanceKm };
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function estimateTravelTime(distanceMiles, mode = 'walking') {
    const speeds = { walking: 3, cycling: 12, bus: 15 };
    return Math.round((distanceMiles / speeds[mode]) * 60);
}

/**
 * Display results
 */
function displaySearchResults(stops) {
    if (stops.length === 0) {
        searchResults.innerHTML = `
            <div class="error-message">
                <strong>No stops found</strong>
                <p>Try searching for: London, Manchester, Birmingham, Leeds</p>
            </div>
        `;
        return;
    }
    
    searchResults.innerHTML = stops.map(stop => {
        const statusClass = stop.Status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
        
        return `
            <div class="stop-card">
                <h3>🚏 ${stop.CommonName}</h3>
                <div class="stop-detail">
                    <span><strong>ATCO Code:</strong></span>
                    <span>${stop.ATCOCode}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Type:</strong></span>
                    <span>${stop.StopType}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Locality:</strong></span>
                    <span>${stop.LocalityName}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Status:</strong></span>
                    <span class="stop-status ${statusClass}">${stop.Status}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Coordinates:</strong></span>
                    <span>${stop.Latitude.toFixed(4)}°N, ${Math.abs(stop.Longitude).toFixed(4)}°${stop.Longitude >= 0 ? 'E' : 'W'}</span>
                </div>
                <button class="btn btn-secondary" onclick='useThisStop(${JSON.stringify(stop).replace(/'/g, "&#39;")})'>
                    Use This Stop 📋
                </button>
            </div>
        `;
    }).join('');
}

function useThisStop(stop) {
    if (!selectedFromStop) {
        selectedFromStop = stop;
        fromStopInput.value = `${stop.CommonName} (${stop.ATCOCode})`;
        toStopInput.readOnly = false;
        toStopInput.placeholder = 'Search another stop and select it';
        alert(`✅ "${stop.CommonName}" set as FROM stop`);
    } else {
        selectedToStop = stop;
        toStopInput.value = `${stop.CommonName} (${stop.ATCOCode})`;
        alert(`✅ "${stop.CommonName}" set as TO stop. Click Calculate!`);
    }
}

function displayDistanceResults(fromStop, toStop) {
    const distance = calculateDistance(
        fromStop.Latitude, fromStop.Longitude,
        toStop.Latitude, toStop.Longitude
    );
    const walkTime = estimateTravelTime(distance.miles, 'walking');
    const busTime = estimateTravelTime(distance.miles, 'bus');
    
    distanceResults.innerHTML = `
        <div class="distance-result">
            <h3>📏 ${distance.miles.toFixed(2)} miles</h3>
            <p><strong>${distance.km.toFixed(2)} km</strong></p>
            <hr style="margin: 15px 0; border: none; border-top: 2px solid #e0e0e0;">
            <p>🚶 Walking: ~${walkTime} minutes</p>
            <p>🚌 Bus: ~${busTime} minutes</p>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0;"><strong>From:</strong> ${fromStop.CommonName}</p>
            <p style="margin: 5px 0;"><strong>To:</strong> ${toStop.CommonName}</p>
        </div>
    `;
}

function showError(message, container) {
    container.innerHTML = `
        <div class="error-message">
            <strong>⚠️ Error</strong>
            <p>${message}</p>
            <p><small>The API may be temporarily unavailable. Try again in a moment.</small></p>
        </div>
    `;
}

// EVENT LISTENERS
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    
    if (!query) {
        alert('Please enter a search term');
        return;
    }
    
    searchBtn.disabled = true;
    searchBtnText.style.display = 'none';
    searchSpinner.style.display = 'inline-block';
    searchResults.innerHTML = '<p class="placeholder-text">⏳ Downloading NaPTAN data... This may take 10-15 seconds...</p>';
    
    try {
        const stops = await searchNaPTANStops(query);
        displaySearchResults(stops);
    } catch (error) {
        console.error('Search failed:', error);
        showError('Failed to search stops. The NaPTAN API may be temporarily unavailable.', searchResults);
    } finally {
        searchBtn.disabled = false;
        searchBtnText.style.display = 'inline';
        searchSpinner.style.display = 'none';
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});

calculateBtn.addEventListener('click', () => {
    if (!selectedFromStop || !selectedToStop) {
        alert('Please select both FROM and TO stops first');
        return;
    }
    displayDistanceResults(selectedFromStop, selectedToStop);
});

console.log('✅ NaPTAN Stop Finder initialized');
console.log('🔍 Try searching for: London, Manchester, Oxford');
