from pathlib import Path
import pandas as pd


def read_csv_auto(path, **kwargs):
    """
    CSV 파일 인코딩을 자동으로 시도해서 불러오는 함수
    """
    path = Path(path)

    encodings = ["utf-8-sig", "utf-8", "cp949", "euc-kr"]

    last_error = None

    for enc in encodings:
        try:
            df = pd.read_csv(path, encoding=enc, **kwargs)
            print(f"로드 성공: {path.name} / encoding={enc} / shape={df.shape}")
            return df

        except UnicodeDecodeError as error:
            last_error = error

    raise last_error

def check_dong_row_count(df, dong_col="dong_nm"):
    """
    행정동별 행 개수 확인

    Parameters
    ----------
    df : pd.DataFrame
    dong_col : str
        행정동 컬럼명

    Returns
    -------
    pd.DataFrame
    """
    
    result = (
        df
        .groupby(dong_col)
        .size()
        .reset_index(name="row_count")
        .sort_values("row_count", ascending=False)
    )

    return result