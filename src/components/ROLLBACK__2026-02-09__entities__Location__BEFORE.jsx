# ROLLBACK SNAPSHOT - entities/Location.json BEFORE

Date: 2026-02-09
Purpose: Add marina fee configuration fields

```json
{
  "name": "Location",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Marina or location name"
    },
    "location_type": {
      "type": "string",
      "enum": ["Marina", "Dry Marina", "Anchorage", "Yard", "Alpha Base", "Other"],
      "default": "Marina"
    },
    "region": {
      "type": "string",
      "enum": ["Istria", "Slovenia", "North Italy", "Other"],
      "default": "Istria"
    },
    "address": {
      "type": "string"
    },
    "city": {
      "type": "string"
    },
    "country": {
      "type": "string"
    },
    "latitude": {
      "type": "number"
    },
    "longitude": {
      "type": "number"
    },
    "access_notes": {
      "type": "string",
      "description": "Gate codes, parking, access restrictions"
    },
    "contact_person": {
      "type": "string"
    },
    "contact_phone": {
      "type": "string"
    },
    "opening_hours": {
      "type": "string"
    },
    "is_partner": {
      "type": "boolean",
      "default": false
    },
    "status": {
      "type": "string",
      "enum": ["Active", "Inactive"],
      "default": "Active"
    }
  },
  "required": ["name", "location_type"]
}
``