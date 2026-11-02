import re
from datetime import datetime


STUDENT_CODE_PATTERN = re.compile(r"^GRD-\d{4}-\d{4}$")


def generate_student_code(cursor, admission_year=None):
    """Reserve a unique sequential code while the caller's transaction is open."""
    year = admission_year or datetime.now().year
    if not 1000 <= int(year) <= 9999:
        raise ValueError("Admission year must be a four-digit year")

    cursor.execute(
        """INSERT INTO student_code_sequences (admission_year, last_number)
           VALUES (%s, 0)
           ON DUPLICATE KEY UPDATE admission_year = VALUES(admission_year)""",
        (year,)
    )
    cursor.execute(
        "SELECT last_number FROM student_code_sequences WHERE admission_year = %s FOR UPDATE",
        (year,)
    )
    sequence = cursor.fetchone()
    last_number = sequence["last_number"] if isinstance(sequence, dict) else sequence[0]
    next_number = int(last_number) + 1
    if next_number > 9999:
        raise RuntimeError(f"Student code sequence exhausted for {year}")

    cursor.execute(
        "UPDATE student_code_sequences SET last_number = %s WHERE admission_year = %s",
        (next_number, year)
    )
    return f"GRD-{year}-{next_number:04d}"
