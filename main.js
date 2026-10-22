const accessToken = document.querySelector('meta[name="mapbox-access-token"]').content;
mapboxgl.accessToken = accessToken;

const initialCenter = [-111.94, 33.4255];
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: initialCenter,
    zoom: 15,
    pitch: 60,
    bearing: -17
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

const addressForm = document.getElementById('address-form');
const addressInput = document.getElementById('address');
const mapStatus = document.getElementById('map-status');
const viewToggle = document.getElementById('map-view-toggle');
let addressMarker;
let is3D = true;

addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && !event.defaultPrevented) {
        event.preventDefault();
        addressForm.requestSubmit();
    }
});

map.on('load', () => {
    const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol');

    map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        filter: ['==', ['get', 'extrude'], 'true'],
        paint: {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                15, 0,
                15.05, ['get', 'height']
            ],
            'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                15, 0,
                15.05, ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.8
        }
    }, firstSymbolLayer?.id);

    viewToggle.disabled = false;
});

viewToggle.addEventListener('click', () => {
    is3D = !is3D;
    viewToggle.setAttribute('aria-pressed', String(is3D));
    viewToggle.setAttribute('aria-label', is3D ? 'Switch to 2D' : 'Switch to 3D');
    map.easeTo({
        pitch: is3D ? 60 : 0,
        bearing: is3D ? -17 : 0,
        duration: 700
    });
});

addressForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const address = addressInput.value.trim();

    if (!address) {
        mapStatus.textContent = 'Enter an address to place a pin on the map.';
        return;
    }

    mapStatus.textContent = 'Finding address…';
    const params = new URLSearchParams({
        access_token: accessToken,
        country: 'US',
        limit: '1',
        proximity: `${initialCenter[0]},${initialCenter[1]}`
    });

    try {
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?${params}`
        );
        if (!response.ok) {
            throw new Error(`Address lookup failed (${response.status}).`);
        }

        const result = await response.json();
        const feature = result.features?.[0];
        if (!feature) {
            mapStatus.textContent = 'No matching address found. Check the address and try again.';
            return;
        }

        const [longitude, latitude] = feature.center;
        if (addressMarker) {
            addressMarker.setLngLat([longitude, latitude]);
        } else {
            addressMarker = new mapboxgl.Marker({ color: '#d32f2f' });
        }
        addressMarker.addTo(map);
        map.flyTo({ center: [longitude, latitude], zoom: 16 });
        mapStatus.textContent = `Pin added for ${feature.place_name}.`;
    } catch (error) {
        mapStatus.textContent = 'Unable to find that address right now. Please try again.';
        console.error(error);
    }
});