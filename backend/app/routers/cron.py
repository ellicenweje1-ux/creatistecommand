"""External cron hook — lets an uptime/cron service drive scheduled jobs reliably even
when the free-tier instance has been asleep. Protected by the CRON_SECRET shared secret
(sent as the X-Cron-Key header); disabled until that secret is set."""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..scheduler import run_trial_reminders

router = APIRouter(prefix="/cron", tags=["cron"])


def _require_cron_key(x_cron_key: str = Header(default="")):
    if not config.CRON_SECRET or x_cron_key != config.CRON_SECRET:
        raise HTTPException(403, "Invalid or missing cron key.")


@router.post("/trial-reminders", dependencies=[Depends(_require_cron_key)])
def trial_reminders(db: Session = Depends(get_db)):
    return run_trial_reminders(db)
