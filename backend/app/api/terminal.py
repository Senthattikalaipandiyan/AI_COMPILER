import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.interactive_session import SessionManager

router = APIRouter(prefix="/api/ws", tags=["Terminal WebSocket"])


@router.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    session = SessionManager.get_or_create(session_id, websocket)

    # Acknowledge connected session
    await session.send_msg("status", status="ready", session_id=session_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "start":
                # If a process is already running in this session, interrupt it first
                if session.is_running:
                    session.interrupt(force=True)

                runtime = data.get("runtime", "python")
                code = data.get("code", "")
                command = data.get("command", "")
                opt_level = data.get("opt_level", "-O3")

                if runtime == "shell" or (command and not code):
                    await session.start_command(command)
                elif runtime == "mojo":
                    await session.start_mojo(code, opt_level)
                else:
                    await session.start_python(code)

            elif msg_type == "stdin":
                input_data = data.get("data", "")
                session.write_stdin(input_data)

            elif msg_type == "interrupt":
                session.interrupt()
                await session.send_msg("output", stream="system", data="^C\nProcess interrupted.\n")

            elif msg_type == "ping":
                await session.send_msg("pong")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await session.send_msg("output", stream="stderr", data=f"WebSocket error: {str(e)}\n")
    finally:
        SessionManager.remove(session_id)
