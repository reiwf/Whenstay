--message_deliveries_status_ts
begin
  if tg_op = 'INSERT' then
    if new.status = 'queued'    and new.queued_at    is null then new.queued_at    := now(); end if;
    if new.status = 'sent'      and new.sent_at      is null then new.sent_at      := now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
    if new.status = 'read'      and new.read_at      is null then new.read_at      := now(); end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status,'') <> new.status then
    case new.status
      when 'queued'    then if new.queued_at    is null then new.queued_at    := now(); end if;
      when 'sent'      then if new.sent_at      is null then new.sent_at      := now(); end if;
      when 'delivered' then if new.delivered_at is null then new.delivered_at := now(); end if;
      when 'read'      then if new.read_at      is null then new.read_at      := now(); end if;
    end case;
  end if;

  return new;
end 