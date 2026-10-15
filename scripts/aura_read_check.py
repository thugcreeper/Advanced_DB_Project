"""Read-only Aura availability check. Credentials come only from the environment."""

import logging
import os
import sys
import time
from urllib.parse import urlsplit

from neo4j import GraphDatabase, READ_ACCESS, unit_of_work
from neo4j.exceptions import Neo4jError, ServiceUnavailable, SessionExpired

# Driver exceptions/logs can contain server addresses. Print only controlled messages.
logging.getLogger("neo4j").addHandler(logging.NullHandler())
logging.getLogger("neo4j").propagate = False
QUERY = "MATCH (f:`醫療院所`) RETURN f.sourceId IS NOT NULL AS has_source_id LIMIT 1"
KEYS = ("AURA_CONNECTION_URI", "AURA_PASSWD", "NEO4J_USERNAME", "NEO4J_DATABASE")


@unit_of_work(timeout=10)
def read_facility(tx):
    row = tx.run(QUERY).single(strict=True)
    if row["has_source_id"] is not True:
        raise ValueError("Facility sourceId missing")


def main():
    values = {key: os.environ.get(key, "") for key in KEYS}
    if any(not value.strip() for value in values.values()):
        print("Aura check failed: configure all four required GitHub Secrets.", file=sys.stderr)
        return 1
    try:
        uri = urlsplit(values["AURA_CONNECTION_URI"])
        if uri.scheme != "neo4j+s" or not uri.hostname or uri.username or uri.password:
            raise ValueError("Invalid secure URI")
    except ValueError:
        print("Aura check failed: a valid neo4j+s URI is required.", file=sys.stderr)
        return 1

    for attempt in range(3):
        try:
            with GraphDatabase.driver(
                values["AURA_CONNECTION_URI"],
                auth=(values["NEO4J_USERNAME"], values["AURA_PASSWD"]),
                connection_timeout=5,
                connection_acquisition_timeout=10,
                max_connection_pool_size=1,
                max_transaction_retry_time=0,
            ) as driver:
                with driver.session(
                    database=values["NEO4J_DATABASE"], default_access_mode=READ_ACCESS
                ) as session:
                    session.execute_read(read_facility)
            print("Aura read check passed: facility data is available.")
            return 0
        except (ServiceUnavailable, SessionExpired):
            retryable = True
        except Neo4jError as exc:
            retryable = exc.is_retryable()
        except Exception:
            retryable = False
        if not retryable or attempt == 2:
            print(
                "Aura read check failed. Check Secrets and Aura Console status; "
                "a paused instance must be resumed separately. No data was changed.",
                file=sys.stderr,
            )
            return 1
        print("Temporary connection failure; retrying.")
        time.sleep((5, 15)[attempt])
    return 1


if __name__ == "__main__":
    sys.exit(main())
