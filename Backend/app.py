from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ---------------- HOME TEST ----------------
@app.route("/")
def home():
    return "Flask backend is running successfully 🔥"


# ---------------- GEOCODING (NOMINATIM) ----------------
@app.route("/geocode")
def geocode():
    place = request.args.get("place")

    if not place:
        return jsonify({"error": "Place name is required"}), 400

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": place,
        "format": "json",
        "limit": 1
    }

    headers = {
        "User-Agent": "multi-route-optimizer-project"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        if len(data) == 0:
            return jsonify({"error": "Location not found"}), 404

        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])

        return jsonify({
            "place": place,
            "latitude": lat,
            "longitude": lon
        })
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Geocoding service error: {str(e)}"}), 500


# ---------------- ROUTING (OSRM MULTIPLE ROUTES) ----------------
@app.route("/route")
def route():
    start_lat = request.args.get("start_lat")
    start_lng = request.args.get("start_lng")
    end_lat = request.args.get("end_lat")
    end_lng = request.args.get("end_lng")

    if not all([start_lat, start_lng, end_lat, end_lng]):
        return jsonify({"error": "Start and end coordinates are required"}), 400

    # OSRM expects: longitude,latitude
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"

    params = {
        "alternatives": "true",      # Request multiple route alternatives
        "geometries": "geojson",
        "overview": "full",
        "steps": "true"              # Get detailed steps for better analysis
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if "routes" not in data or len(data["routes"]) == 0:
            return jsonify({"error": "No routes found"}), 404

        routes = data["routes"]

        # Process and rank routes
        result = []

        for idx, route in enumerate(routes):
            distance_km = round(route["distance"] / 1000, 2)
            duration_min = round(route["duration"] / 60, 2)
            
            # Calculate average speed (km/h)
            avg_speed = round((distance_km / (duration_min / 60)), 1) if duration_min > 0 else 0
            
            # Calculate traffic score (simulated based on speed)
            # Lower speed = more traffic = higher score
            if avg_speed > 50:
                traffic_score = 1  
            elif avg_speed > 30:
                traffic_score = 2 
            else:
                traffic_score = 3 
            
            # Calculate overall score (lower is better)
            # Prioritize time, then distance, then traffic
            overall_score = (duration_min * 2) + (distance_km * 0.5) + (traffic_score * 10)
            
            result.append({
                "rank": idx + 1,
                "distance_km": distance_km,
                "duration_min": duration_min,
                "avg_speed": avg_speed,
                "traffic_score": traffic_score,
                "overall_score": overall_score,
                "geometry": route["geometry"]
            })

        # Sort routes by overall score (best to worst)
        result.sort(key=lambda r: r["overall_score"])
        
        # Update ranks after sorting
        for idx, route in enumerate(result):
            route["rank"] = idx + 1

        return jsonify({
            "total_routes": len(result),
            "routes": result,
            "recommendation": {
                "best_route_index": 0,
                "reason": "Fastest route with optimal traffic conditions",
                "time_saved": round(result[1]["duration_min"] - result[0]["duration_min"], 1) if len(result) > 1 else 0
            }
        })
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Routing service error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)