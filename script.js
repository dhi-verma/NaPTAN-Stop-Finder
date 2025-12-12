// ============================================
// NaPTAN Bus Stop Finder - Main JavaScript
// ============================================

// Global variables to store selected stops
let selectedFromStop = null;
let selectedToStop = null;

// DOM Elements
const searchInput = document.getElementById('stopSearch');
const searchBtn = document.getElementById('searchBtn');
const searchBtnText = document.getElementById('searchBtnText');
const searchSpinner = document.getElementById('searchSpinner');
const searchResults = document.getElementById('searchResults');
const fromStopInput = document.getElementById('fromStop');
const toStopInput = document.getElementById('toStop');
const calculateBtn = document.getElementById('calculateBtn');
const distanceResults = document.getElementById('distanceResults');

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Search NaPTAN database for bus stops
 * @param {string} query - Search term (stop name, postcode, etc.)
 * @returns {Promise<Array>} - Array of stop objects
 */
async function searchNaPTANStops(query) {
    try {
        // NaPTAN API endpoint - searches for stops
        const apiUrl = `https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=json&query=${encodeURIComponent(query)}`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Return array of stops (API returns different structures)
        if (Array.isArray(data)) {
            return data.slice(0, 10); // Limit to 10 results
        } else if (data.member && Array.isArray(data.member)) {
            return data.member.slice(0, 10);
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error fetching NaPTAN data:', error);
        throw error;
    }
}

/**
 * Get stop details by ATCO code
 * @param {string} atcoCode - ATCO code of the stop
 * @returns {Promise<Object>} - Stop object
 */
async function getStopByATCOCode(atcoCode) {
    try {
        const apiUrl = `https://naptan.api.dft.gov.uk/v1/access-nodes/${atcoCode}?dataFormat=json`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`Stop not found: ${atcoCode}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching stop details:', error);
        throw error;
    }
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {Object} - Distance in miles and km
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
    
    return {
        miles: distanceMiles,
        km: distanceKm
    };
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} - Radians
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Estimate travel time based on distance and mode
 * @param {number} distanceMiles - Distance in miles
 * @param {string} mode - Travel mode (walking, cycling, bus)
 * @returns {number} - Time in minutes
 */
function estimateTravelTime(distanceMiles, mode = 'walking') {
    const speeds = {
        walking: 3,   // mph
        cycling: 12,  // mph
        bus: 15       // mph (urban average)
    };
    
    const hours = distanceMiles / speeds[mode];
    return Math.round(hours * 60); // return minutes
}

// ============================================
// UI FUNCTIONS
// ============================================

/**
 * Display search results in the left panel
 * @param {Array} stops - Array of stop objects
 */
function displaySearchResults(stops) {
    if (stops.length === 0) {
        searchResults.innerHTML = `
            <div class="error-message">
                <strong>No stops found</strong>
                <p>Try a different search term (e.g., area name, postcode, or stop name)</p>
            </div>
        `;
        return;
    }
    
    searchResults.innerHTML = stops.map(stop => {
        const atcoCode = stop.ATCOCode || stop.atcoCode || 'N/A';
        const commonName = stop.CommonName || stop.name || 'Unnamed Stop';
        const locality = stop.LocalityName || stop.locality || 'Unknown';
        const stopType = stop.StopType || stop.stopType || 'Bus Stop';
        const status = stop.Status || stop.status || 'Active';
        const lat = stop.Latitude || stop.latitude || 0;
        const lon = stop.Longitude || stop.longitude || 0;
        
        const statusClass = status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
        
        return `
            <div class="stop-card">
                <h3>🚏 ${commonName}</h3>
                <div class="stop-detail">
                    <span><strong>ATCO Code:</strong></span>
                    <span>${atcoCode}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Type:</strong></span>
                    <span>${stopType}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Locality:</strong></span>
                    <span>${locality}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Status:</strong></span>
                    <span class="stop-status ${statusClass}">${status}</span>
                </div>
                <div class="stop-detail">
                    <span><strong>Coordinates:</strong></span>
                    <span>${lat.toFixed(4)}°N, ${lon.toFixed(4)}°${lon >= 0 ? 'E' : 'W'}</span>
                </div>
                <button class="btn btn-secondary" onclick='useThisStop(${JSON.stringify(stop)})'>
                    Use This Stop 📋
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Use selected stop for distance calculation
 * @param {Object} stop - Stop object
 */
function useThisStop(stop) {
    const atcoCode = stop.ATCOCode || stop.atcoCode || 'N/A';
    const commonName = stop.CommonName || stop.name || 'Unnamed Stop';
    
    // Store stop in "From" field if empty, otherwise "To" field
    if (!selectedFromStop) {
        selectedFromStop = stop;
        fromStopInput.value = `${commonName} (${atcoCode})`;
        toStopInput.readOnly = false;
        toStopInput.placeholder = 'Search another stop and select it';
        alert(`✅ "${commonName}" set as FROM stop. Now search for your TO stop.`);
    } else {
        selectedToStop = stop;
        toStopInput.value = `${commonName} (${atcoCode})`;
        alert(`✅ "${commonName}" set as TO stop. Click "Calculate Distance" to see results.`);
    }
}

/**
 * Display distance calculation results
 * @param {Object} fromStop - From stop object
 * @param {Object} toStop - To stop object
 */
function displayDistanceResults(fromStop, toStop) {
    const lat1 = fromStop.Latitude || fromStop.latitude;
    const lon1 = fromStop.Longitude || fromStop.longitude;
    const lat2 = toStop.Latitude || toStop.latitude;
    const lon2 = toStop.Longitude || toStop.longitude;
    
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
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
            <p style="margin: 5px 0;"><strong>From:</strong> ${fromStop.CommonName || fromStop.name}</p>
            <p style="margin: 5px 0;"><strong>To:</strong> ${toStop.CommonName || toStop.name}</p>
        </div>
    `;
}

/**
 * Show error message
 * @param {string} message - Error message
 * @param {HTMLElement} container - Container to display error
 */
function showError(message, container) {
    container.innerHTML = `
        <div class="error-message">
            <strong>⚠️ Error</strong>
            <p>${message}</p>
        </div>
    `;
}

// ============================================
// EVENT LISTENERS
// ============================================

// Search button click
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    
    if (!query) {
        alert('Please enter a search term');
        return;
    }
    
    // Show loading state
    searchBtn.disabled = true;
    searchBtnText.style.display = 'none';
    searchSpinner.style.display = 'inline-block';
    searchResults.innerHTML = '<p class="placeholder-text">Searching NaPTAN database...</p>';
    
    try {
        const stops = await searchNaPTANStops(query);
        displaySearchResults(stops);
    } catch (error) {
        showError('Failed to search stops. Please try again.', searchResults);
    } finally {
        // Reset button state
        searchBtn.disabled = false;
        searchBtnText.style.display = 'inline';
        searchSpinner.style.display = 'none';
    }
});

// Enter key in search input
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// Calculate distance button
calculateBtn.addEventListener('click', () => {
    if (!selectedFromStop || !selectedToStop) {
        alert('Please select both FROM and TO stops first');
        return;
    }
    
    displayDistanceResults(selectedFromStop, selectedToStop);
});

// ============================================
// INITIALIZATION
// ============================================

console.log('NaPTAN Bus Stop Finder initialized ✅');
console.log('Search for stops to get started!');

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateDistance,
        toRadians,
        estimateTravelTime,
        searchNaPTANStops,
        getStopByATCOCode
    };
}
