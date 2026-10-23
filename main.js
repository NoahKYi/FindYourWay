
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithPopup,
    GoogleAuthProvider,
    reload,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBktWFz-RbKArY3MHhkpz4dPYPI1nL7h40",
    authDomain: "azfindroute.firebaseapp.com",
    projectId: "azfindroute",
    storageBucket: "azfindroute.firebasestorage.app",
    messagingSenderId: "677958021997",
    appId: "1:677958021997:web:23e8a3ae037d98a42da064",
    measurementId: "G-EDF773BX22"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const emailForm = document.getElementById("email-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authStatus = document.getElementById("auth-status");
const verificationView = document.getElementById("verification-view");

const accessToken = document.querySelector(
    'meta[name="mapbox-access-token"]'
).content;

let map = null;
let addressMarker = null;
let is3D = true;
let mapInitialized = false;
let mapInitializing = false;

function showMessage(message) {
    authStatus.textContent = message;
}

function loadScript(src, id) {
    return new Promise((resolve, reject) => {
        const existing = document.getElementById(id);

        if (existing?.dataset.loaded === "true") {
            resolve();
            return;
        }

        const script = existing || document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;

        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };

        script.onerror = () => {
            reject(new Error("Could not load " + src));
        };

        if (!existing) {
            document.head.appendChild(script);
        }
    });
}

async function initializeMap() {
    if (mapInitialized || mapInitializing) return;

    mapInitializing = true;

    try {
        await loadScript(
            "https://api.mapbox.com/mapbox-gl-js/v3.14.0/mapbox-gl.js",
            "mapbox-gl-script"
        );

        mapboxgl.accessToken = accessToken;

        const initialCenter = [-111.94, 33.4255];

        map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: initialCenter,
            zoom: 15,
            pitch: 60,
            bearing: -17
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        const addressForm = document.getElementById("address-form");
        const addressInput = document.getElementById("address");
        const mapStatus = document.getElementById("map-status");
        const viewToggle = document.getElementById("map-view-toggle");

        map.on("load", () => {
            const firstSymbolLayer = map.getStyle().layers.find(
                layer => layer.type === "symbol"
            );

            map.addLayer({
                id: "3d-buildings",
                source: "composite",
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 14,
                filter: ["==", ["get", "extrude"], "true"],
                paint: {
                    "fill-extrusion-color": "#aaa",
                    "fill-extrusion-height": [
                        "interpolate", ["linear"], ["zoom"],
                        15, 0,
                        15.05, ["get", "height"]
                    ],
                    "fill-extrusion-base": [
                        "interpolate", ["linear"], ["zoom"],
                        15, 0,
                        15.05, ["get", "min_height"]
                    ],
                    "fill-extrusion-opacity": 0.8
                }
            }, firstSymbolLayer?.id);

            viewToggle.disabled = false;
            map.resize();
        });

        viewToggle.addEventListener("click", () => {
            is3D = !is3D;

            viewToggle.setAttribute("aria-pressed", String(is3D));
            viewToggle.setAttribute(
                "aria-label",
                is3D ? "Switch to 2D" : "Switch to 3D"
            );

            map.easeTo({
                pitch: is3D ? 60 : 0,
                bearing: is3D ? -17 : 0,
                duration: 700
            });
        });

        addressForm.addEventListener("submit", async event => {
            event.preventDefault();

            const address = addressInput.value.trim();

            if (!address) {
                mapStatus.textContent = "Enter an address to search.";
                return;
            }

            mapStatus.textContent = "Finding address…";

            const params = new URLSearchParams({
                access_token: accessToken,
                country: "US",
                limit: "1",
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
                    mapStatus.textContent =
                        "No matching address found. Check the address and try again.";
                    return;
                }

                const [longitude, latitude] = feature.center;

                if (addressMarker) {
                    addressMarker.setLngLat([longitude, latitude]);
                } else {
                    addressMarker = new mapboxgl.Marker({ color: "#d32f2f" });
                }

                addressMarker.addTo(map);

                map.flyTo({
                    center: [longitude, latitude],
                    zoom: 16
                });

                mapStatus.textContent = `Pin added for ${feature.place_name}.`;
            } catch (error) {
                console.error(error);
                mapStatus.textContent =
                    "Unable to find that address. Please try again.";
            }
        });

        mapInitialized = true;
    } catch (error) {
        console.error(error);
        document.getElementById("map-status").textContent =
            "The map failed to load. Refresh the page and try again.";
    } finally {
        mapInitializing = false;
    }
}

document.getElementById("create-account").addEventListener("click", async () => {
    if (!emailForm.reportValidity()) return;

    showMessage("Creating your account...");
    verificationView.hidden = true;

    try {
        const credential = await createUserWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        );

        await sendEmailVerification(credential.user);

        showMessage("Verification email sent. Check your inbox.");
    } catch (error) {
        console.error(error);
        showMessage(error.message);
    }
});

document.getElementById("email-sign-in").addEventListener("click", () => {
    emailForm.requestSubmit();
});

emailForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("Signing in...");

    try {
        await signInWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        );

        showMessage("");
    } catch (error) {
        console.error(error);
        showMessage(error.message);
    }
});

document.getElementById("google-sign-in").addEventListener("click", async () => {
    showMessage("Opening Google sign-in...");

    try {
        await signInWithPopup(auth, googleProvider);
        showMessage("");
    } catch (error) {
        console.error(error);
        showMessage(error.message);
    }
});

document.getElementById("resend-verification").addEventListener("click", async () => {
    const user = auth.currentUser;

    if (!user) {
        showMessage("Please sign in again to resend the verification email.");
        return;
    }

    try {
        await sendEmailVerification(user);
        showMessage("Verification email sent. Check your inbox.");
    } catch (error) {
        console.error(error);
        showMessage(error.message);
    }
});

document.getElementById("check-verification").addEventListener("click", async () => {
    const user = auth.currentUser;

    if (!user) return;

    try {
        await reload(user);

        if (auth.currentUser.emailVerified) {
            showMessage("Email verified!");
            verificationView.hidden = true;
            authView.hidden = true;
            appView.hidden = false;
            await initializeMap();
        } else {
            showMessage("Your email is not verified yet. Check your inbox.");
        }
    } catch (error) {
        console.error(error);
        showMessage("Unable to check verification. Please try again.");
    }
});

document.getElementById("sign-out").addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error(error);
        showMessage("Unable to sign out. Please try again.");
    }
});

onAuthStateChanged(auth, async user => {
    authView.hidden = false;
    appView.hidden = true;
    verificationView.hidden = true;

    if (!user) {
        showMessage("");
        return;
    }

    try {
        await reload(user);

        if (auth.currentUser.emailVerified) {
            verificationView.hidden = true;
            authView.hidden = true;
            appView.hidden = false;

            await initializeMap();
        } else {
            authView.hidden = false;
            appView.hidden = true;
            verificationView.hidden = false;

            showMessage("Verify your email before accessing the map.");
        }
    } catch (error) {
        console.error(error);
        showMessage("Unable to check your account. Please try again.");
    }
});
