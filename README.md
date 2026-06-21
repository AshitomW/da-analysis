## Dataset Toggle

The backend can serve either the original dataset or the cleaned dataset.

### Switch to cleaned

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/data/set-active -Body (@{ dataset = "cleaned" } | ConvertTo-Json) -ContentType "application/json"
```

```bash
curl -X POST http://127.0.0.1:8000/api/data/set-active \
	-H "Content-Type: application/json" \
	-d '{"dataset":"cleaned"}'
```

### Switch back to original

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/data/set-active -Body (@{ dataset = "original" } | ConvertTo-Json) -ContentType "application/json"
```

```bash
curl -X POST http://127.0.0.1:8000/api/data/set-active \
	-H "Content-Type: application/json" \
	-d '{"dataset":"original"}'
```

### Verify current state

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/data/status
```

```bash
curl http://127.0.0.1:8000/api/data/status
```

Notes:

- The live FastAPI app starts on the cleaned dataset automatically from `backend/cleaning_config.yaml`.
- The Explore and Data Quality pages show whichever dataset is currently active.
- If you change the active dataset, refresh the frontend to see the update.
