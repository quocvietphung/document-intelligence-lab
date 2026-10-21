-- Different fields/currencies are never added together; only explicitly verified documents enter Gold.
select field_key, currency, count(*) as observations, sum(amount) as total
from silver_fields
where run_id = '{{ var("run_id") }}' and quality = 'VALID'
  and reviewed and amount is not null and currency is not null
group by field_key, currency
