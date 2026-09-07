"""File mau de test Accept / Diff khi agent sua file (vong 6)."""


def tinh_tong(a: float, b: float) -> float:
    """Tra ve tong cua hai so."""
    return a + b


def tinh_hieu(a: float, b: float) -> float:
    """Tra ve hieu cua hai so (sua bua vong 6 de test diff)."""
    return a - b


def tinh_trung_binh(numbers: list[float]) -> float:
    """Tra ve trung binh cong; danh sach rong tra ve 0."""
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)


def dinh_dang_ket_qua(nhan: str, gia_tri: float) -> str:
    """Tao chuoi ket qua de de doc tren terminal."""
    return f"{nhan}: {gia_tri:.2f}"


def tim_gia_tri_lon_nhat(numbers: list[float]) -> float | None:
    """Tra ve gia tri lon nhat, hoac None neu danh sach rong."""
    return max(numbers) if numbers else None


if __name__ == "__main__":
    du_lieu = [1, 2, 3, 4, 5]
    tong = tinh_tong(2, 3)
    trung_binh = tinh_trung_binh(du_lieu)
    lon_nhat = tim_gia_tri_lon_nhat(du_lieu)
    print(dinh_dang_ket_qua("Tong", tong))
    print(dinh_dang_ket_qua("Trung binh", trung_binh))
    print(dinh_dang_ket_qua("Lon nhat", lon_nhat or 0.0))
