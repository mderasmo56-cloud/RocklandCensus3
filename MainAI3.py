import requests
import pandas as pd
import openai
import os

# -------------------------------------------------
# OPENAI API CONFIG
# -------------------------------------------------
openai.api_key = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY_HERE")

# -------------------------------------------------
# CENSUS CONFIG / CONSTANTS
# -------------------------------------------------

CENSUS_API_KEY = os.getenv("CENSUS_API_KEY")

# -- ACS endpoints (2021)
BASE_URL = "https://api.census.gov/data/2021/acs/acs5"  # For B01001/B19001 data
BASE_URL_SUBJECT = "https://api.census.gov/data/2021/acs/acs5/subject"  # For S2401 data

# -- 2020 Decennial DHC endpoint (for P8 Race)
BASE_URL_2020_DHC = "https://api.census.gov/data/2020/dec/dhc"

# Adjust pandas display so we can see wide DataFrames in the console
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 300)

ROCKLAND_ZIPS_TOWNS = {
    "10901": "Airmont, Suffern",
    "10913": "Blauvelt",
    "10920": "Congers",
    "10923": "Garnerville",
    "10927": "Haverstraw",
    "10931": "Hillburn",
    "10952": "Monsey",
    "10956": "New City",
    "10960": "Nyack, Grand View-on-Hudson",
    "10962": "Orangeburg",
    "10964": "Palisades",
    "10965": "Pearl River",
    "10968": "Piermont",
    "10970": "Pomona",
    "10974": "Sloatsburg",
    "10976": "Sparkill",
    "10977": "Spring Valley, Chestnut Ridge",
    "10980": "Stony Point",
    "10983": "Tappan",
    "10986": "Tomkins Cove",
    "10989": "Valley Cottage",
    "10993": "West Haverstraw",
    "10994": "West Nyack"
}

# -------------------------------------------------
# 1. FETCH POPULATION & INCOME DATA (ACS 2021)
# -------------------------------------------------
def get_population_income_data(zip_codes=ROCKLAND_ZIPS_TOWNS.keys()):
    """
    Fetch total population (B01001_001E) and income range data (B19001_xxx)
    plus median income (B19013_001E) for specified ZIP codes from ACS 5-Year.
    Returns a DataFrame with columns:
        [ZCTA_Name, TotalPopulation, MedianIncome, Income_<ranges>, ZipCode, TownName]
    """
    results = []
    missing_zips = []
    
    income_vars = {
        "B19013_001E": "MedianIncome",
        "B19001_002E": "Income_Less_Than_10K",
        "B19001_003E": "Income_10K_14K",
        "B19001_004E": "Income_15K_24K",
        "B19001_005E": "Income_25K_34K",
        "B19001_006E": "Income_35K_49K",
        "B19001_007E": "Income_50K_74K",
        "B19001_008E": "Income_75K_99K",
        "B19001_009E": "Income_100K_149K",
        "B19001_010E": "Income_150K_199K",
        "B19001_011E": "Income_200K_Plus"
    }
    
    for zip_code in zip_codes:
        params = {
            "get": "NAME,B01001_001E," + ",".join(income_vars.keys()),
            "for": f"zip code tabulation area:{zip_code}",
            "key": CENSUS_API_KEY
        }
        response = requests.get(BASE_URL, params=params)

        if response.status_code == 200:
            data = response.json()
            if len(data) > 1:
                results.append(data[1])
            else:
                missing_zips.append(zip_code)
        else:
            print(f"Error {response.status_code} for ZIP {zip_code}: {response.text}")
            missing_zips.append(zip_code)

    df_cols = ["ZCTA_Name", "TotalPopulation"] + list(income_vars.values()) + ["ZipCode"]
    df = pd.DataFrame(results, columns=df_cols)

    # Convert to numeric
    df["TotalPopulation"] = pd.to_numeric(df["TotalPopulation"], errors="coerce")
    for col in income_vars.values():
        df[col] = pd.to_numeric(df[col], errors="coerce")
    
    # Map to TownName
    df["TownName"] = df["ZipCode"].map(ROCKLAND_ZIPS_TOWNS)
    
    # Fill missing ZIPs if any
    if missing_zips:
        missing_df = pd.DataFrame(missing_zips, columns=["ZipCode"])
        missing_df["ZCTA_Name"] = "N/A"
        missing_df["TotalPopulation"] = None
        for col in income_vars.values():
            missing_df[col] = None
        missing_df["TownName"] = missing_df["ZipCode"].map(ROCKLAND_ZIPS_TOWNS)
        df = pd.concat([df, missing_df], ignore_index=True)
    
    return df

# -------------------------------------------------
# 2. FETCH OCCUPATION DATA (ACS 2021 Subject)
# -------------------------------------------------
def get_occupation_data(zip_codes=ROCKLAND_ZIPS_TOWNS.keys()):
    """
    Fetch ACS 5-Year Subject Table S2401 occupation data for specified ZIP codes.
    Returns a DataFrame with columns for various occupation categories.
    """
    occupation_vars = {
        # Civilian employed population 16 years and over
        "S2401_C01_001E": "CivEmp16Over",
        
        # Management, business, science, and arts occupations
        "S2401_C01_002E": "MgmtBusSciArts",
        "S2401_C01_003E": "MgmtBusFin",
        "S2401_C01_004E": "MgmtOccupations",
        "S2401_C01_005E": "BusinessFinOps",
        
        # Computer, engineering, and science
        "S2401_C01_006E": "CompEngSci",
        "S2401_C01_007E": "ComputerMath",
        "S2401_C01_008E": "ArchitectureEng",
        "S2401_C01_009E": "LifePhysSci",
        
        # Education, legal, community service, arts, media
        "S2401_C01_010E": "EducLegalCommArtsMedia",
        "S2401_C01_011E": "CommunitySocService",
        "S2401_C01_012E": "Legal",
        "S2401_C01_013E": "EduInstructionLibrary",
        "S2401_C01_014E": "ArtsDesignEntertainmentSportsMedia",
        
        # Healthcare practitioners/technical
        "S2401_C01_015E": "HealthcarePracTech",
        "S2401_C01_016E": "HealthDiagTreat",
        "S2401_C01_017E": "HealthTechs",
        
        # Service occupations
        "S2401_C01_018E": "ServiceOcc",
        "S2401_C01_019E": "HealthcareSupport",
        "S2401_C01_020E": "ProtectiveService",
        "S2401_C01_021E": "FirefightingPreventionEtc",
        "S2401_C01_022E": "LawEnforcementEtc",
        "S2401_C01_023E": "FoodPrepServing",
        "S2401_C01_024E": "BuildingGroundsMaint",
        "S2401_C01_025E": "PersonalCareService",
        
        # Sales and office
        "S2401_C01_026E": "SalesOfficeOcc",
        "S2401_C01_027E": "SalesRelated",
        "S2401_C01_028E": "OfficeAdminSupport",
        
        # Natural resources, construction, maintenance
        "S2401_C01_029E": "NatResConstMaint",
        "S2401_C01_030E": "FarmFishForestry",
        "S2401_C01_031E": "ConstructionExtraction",
        "S2401_C01_032E": "InstallMaintRepair",
        
        # Production, transportation, and material moving
        "S2401_C01_033E": "ProdTransMoving",
        "S2401_C01_034E": "Production",
        "S2401_C01_035E": "Transportation",
        "S2401_C01_036E": "MaterialMoving"
    }

    results = []
    missing_zips = []
    
    for zip_code in zip_codes:
        params = {
            "get": "NAME," + ",".join(occupation_vars.keys()),
            "for": f"zip code tabulation area:{zip_code}",
            "key": CENSUS_API_KEY
        }
        response = requests.get(BASE_URL_SUBJECT, params=params)

        if response.status_code == 200:
            data = response.json()
            if len(data) > 1:
                results.append(data[1])
            else:
                missing_zips.append(zip_code)
        else:
            print(f"Error {response.status_code} for ZIP {zip_code}: {response.text}")
            missing_zips.append(zip_code)

    cols = ["ZCTA_Name"] + list(occupation_vars.values()) + ["ZipCode"]
    occupation_df = pd.DataFrame(results, columns=cols)

    # Convert numeric
    for col in occupation_vars.values():
        occupation_df[col] = pd.to_numeric(occupation_df[col], errors="coerce")

    # Map TownName
    occupation_df["TownName"] = occupation_df["ZipCode"].map(ROCKLAND_ZIPS_TOWNS)

    # Fill missing
    if missing_zips:
        missing_df = pd.DataFrame(missing_zips, columns=["ZipCode"])
        missing_df["ZCTA_Name"] = "N/A"
        for col in occupation_vars.values():
            missing_df[col] = None
        missing_df["TownName"] = missing_df["ZipCode"].map(ROCKLAND_ZIPS_TOWNS)
        occupation_df = pd.concat([occupation_df, missing_df], ignore_index=True)

    return occupation_df

# -------------------------------------------------
# 3. FETCH 2020 DHC Table P8 (Race) [63 Columns]
# -------------------------------------------------

# The Census API has a 50-variable limit, so we split the 63 P8 columns into two chunks
p8_labels = {
    "P8_001N": "Total",
    "P8_002N": "Population of one race",
    "P8_003N": "White alone",
    "P8_004N": "Black or African American alone",
    "P8_005N": "American Indian and Alaska Native alone",
    "P8_006N": "Asian alone",
    "P8_007N": "Native Hawaiian and Other Pacific Islander alone",
    "P8_008N": "Some Other Race alone",
    "P8_009N": "Population of two or more races",
    "P8_010N": "Population of two races",
    "P8_011N": "White; Black or African American",
    "P8_012N": "White; American Indian and Alaska Native",
    "P8_013N": "White; Asian",
    "P8_014N": "White; Native Hawaiian and Other Pacific Islander",
    "P8_015N": "White; Some Other Race",
    "P8_016N": "Black or African American; American Indian and Alaska Native",
    "P8_017N": "Black or African American; Asian",
    "P8_018N": "Black or African American; Native Hawaiian and Other Pacific Islander",
    "P8_019N": "Black or African American; Some Other Race",
    "P8_020N": "American Indian and Alaska Native; Asian",
    "P8_021N": "American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
    "P8_022N": "American Indian and Alaska Native; Some Other Race",
    "P8_023N": "Asian; Native Hawaiian and Other Pacific Islander",
    "P8_024N": "Asian; Some Other Race",
    "P8_025N": "Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_026N": "Population of three races",
    "P8_027N": "White; Black or African American; American Indian and Alaska Native",
    "P8_028N": "White; Black or African American; Asian",
    "P8_029N": "White; Black or African American; Native Hawaiian and Other Pacific Islander",
    "P8_030N": "White; Black or African American; Some Other Race",
    "P8_031N": "White; American Indian and Alaska Native; Asian",
    "P8_032N": "White; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
    "P8_033N": "White; American Indian and Alaska Native; Some Other Race",
    "P8_034N": "White; Asian; Native Hawaiian and Other Pacific Islander",
    "P8_035N": "White; Asian; Some Other Race",
    "P8_036N": "White; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_037N": "Black or African American; American Indian and Alaska Native; Asian",
    "P8_038N": "Black or African American; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
    "P8_039N": "Black or African American; American Indian and Alaska Native; Some Other Race",
    "P8_040N": "Black or African American; Asian; Native Hawaiian and Other Pacific Islander",
    "P8_041N": "Black or African American; Asian; Some Other Race",
    "P8_042N": "Black or African American; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_043N": "American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander",
    "P8_044N": "American Indian and Alaska Native; Asian; Some Other Race",
    "P8_045N": "American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_046N": "Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_047N": "Population of four races",
    "P8_048N": "White; Black or African American; American Indian and Alaska Native; Asian",
    "P8_049N": "White; Black or African American; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
    "P8_050N": "White; Black or African American; American Indian and Alaska Native; Some Other Race",
    "P8_051N": "White; Black or African American; Asian; Native Hawaiian and Other Pacific Islander",
    "P8_052N": "White; Black or African American; Asian; Some Other Race",
    "P8_053N": "White; Black or African American; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_054N": "White; American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander",
    "P8_055N": "White; American Indian and Alaska Native; Asian; Some Other Race",
    "P8_056N": "White; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_057N": "White; Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_058N": "Black or African American; American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander",
    "P8_059N": "Black or African American; American Indian and Alaska Native; Asian; Some Other Race",
    "P8_060N": "Black or African American; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_061N": "Black or African American; Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_062N": "American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
    "P8_063N": "Population of five or six races"
}

p8_codes = list(p8_labels.keys())

# Because we have 63 variables (plus NAME), we must split into 2 requests
chunkA = p8_codes[:31]
chunkB = p8_codes[31:]

def fetch_p8_chunk(zip_codes, p8_chunk):
    """Fetch a subset of P8 columns (<= ~49) for the given ZIPs from the 2020 DHC."""
    zips_str = ",".join(zip_codes)
    get_vars = ["NAME"] + p8_chunk
    params = {
        "get": ",".join(get_vars),
        "for": f"zip code tabulation area:{zips_str}",
        "key": CENSUS_API_KEY
    }
    r = requests.get(BASE_URL_2020_DHC, params=params)
    if r.status_code != 200:
        raise ValueError(f"Error {r.status_code}: {r.text}")
    
    data = r.json()
    if len(data) <= 1:
        return pd.DataFrame(columns=get_vars + ["zip code tabulation area"])
    
    headers = data[0]
    rows = data[1:]
    df = pd.DataFrame(rows, columns=headers)
    return df

def get_p8_race_data(zip_codes=ROCKLAND_ZIPS_TOWNS.keys()):
    """
    Retrieve all 63 columns of 2020 DHC Table P8 (race) for the specified ZIPs.
    Returns a DataFrame with numeric columns named after p8_labels.
    Also includes a 'ZipCode' column and 'TownName'.
    """
    # 1) chunk A
    dfA = fetch_p8_chunk(zip_codes, chunkA)
    # 2) chunk B
    dfB = fetch_p8_chunk(zip_codes, chunkB)
    
    # Merge them on [NAME, zip code tabulation area]
    merged = pd.merge(
        dfA, dfB,
        on=["NAME", "zip code tabulation area"],
        how="outer"
    )
    
    # Rename columns from P8_xxxN to labels + convert to numeric
    for code, label in p8_labels.items():
        if code in merged.columns:
            merged.rename(columns={code: label}, inplace=True)
            merged[label] = pd.to_numeric(merged[label], errors="coerce")
    
    # Convert "zip code tabulation area" into "ZipCode"
    # so we can merge with the ACS data
    merged["ZipCode"] = merged["zip code tabulation area"]
    
    # Map to TownName
    merged["TownName"] = merged["ZipCode"].map(ROCKLAND_ZIPS_TOWNS)

    return merged

# -------------------------------------------------
# 4. MAIN SCRIPT
# -------------------------------------------------
def main():
    # A) Fetch population+income (ACS)
    population_income_df = get_population_income_data()
    print("Population & Income DataFrame:\n", population_income_df, "\n")

    # B) Fetch occupation (ACS)
    occupation_df = get_occupation_data()
    print("Occupation DataFrame:\n", occupation_df, "\n")

    # C) Merge them (ACS merges)
    merged_acs = pd.merge(
        population_income_df, 
        occupation_df, 
        on=["ZipCode", "TownName"], 
        how="outer"
    )
    print("Merged ACS DataFrame:\n", merged_acs, "\n")

    # D) Fetch 2020 DHC P8 Race data
    race_df = get_p8_race_data()
    print("P8 Race DataFrame:\n", race_df, "\n")

    # E) Merge the ACS result with Race data
    final_merged_df = pd.merge(
        merged_acs, 
        race_df, 
        on=["ZipCode", "TownName"], 
        how="outer"
    )
    print("Final Merged (Income, Occupation, Race) DataFrame:\n", final_merged_df, "\n")

    # Convert to CSV
    final_csv = final_merged_df.to_csv(index=False)

    # ----------------------------------
    # Build GPT Prompt
    # ----------------------------------
    prompt_text = (
        "You are an analytical assistant. Below is a merged dataset that combines:\n"
        "- Income data (from 2021 ACS, B19001/B19013)\n"
        "- Occupational data (from 2021 ACS Subject Table S2401)\n"
        "- Race data (from 2020 Decennial Census DHC Table P8, including 63 race categories)\n\n"
        f"Here is the data in CSV format:\n\n{final_csv}\n\n"
        "Please provide a comprehensive semantic analysis exploring the relationship between income distribution, "
        "occupational profile, and racial composition in these Rockland County ZIP codes."
    )

    # Send prompt to OpenAI
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",  # or "gpt-4"/"gpt-3.5-turbo"
            messages=[{"role": "user", "content": prompt_text}],
            max_tokens=1000,
            temperature=0.85,
        )
        print("### GPT Response ###")
        print(response.choices[0].message.content.strip())

    except Exception as e:
        print("OpenAI API Error:", e)

if __name__ == "__main__":
    main()
