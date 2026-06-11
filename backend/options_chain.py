import numpy as np

def get_options_chain(ticker: str, spot_price: float = 23242.1) -> list:
    """
    Generates a realistic option chain data list centered around the current spot price.
    Each item contains Call OI, Call LTP, Call IV, Strike Price, Put IV, Put LTP, Put OI.
    """
    # Round spot price to nearest 50 or 100 strike
    base_strike = round(spot_price / 100) * 100
    
    chain = []
    # Generate 5 strikes below and 5 strikes above
    for offset in range(-5, 6):
        strike = int(base_strike + (offset * 100))
        
        # Calculate Call/Put LTP using a simple Black-Scholes-like mock model
        dist = strike - spot_price
        
        # Call LTP: high when strike is deep in the money (dist is negative)
        call_ltp = max(5.0, -dist + 20.0 + np.random.uniform(-5.0, 5.0) if dist < 0 else 150.0 * np.exp(-dist / 150.0) + np.random.uniform(-3.0, 3.0))
        # Put LTP: high when strike is out of the money (dist is positive)
        put_ltp = max(5.0, dist + 20.0 + np.random.uniform(-5.0, 5.0) if dist > 0 else 150.0 * np.exp(dist / 150.0) + np.random.uniform(-3.0, 3.0))
        
        # Call/Put IV: 10% to 20%
        call_iv = 11.5 + abs(offset) * 0.5 + np.random.uniform(-0.5, 0.5)
        put_iv = 12.0 + abs(offset) * 0.4 + np.random.uniform(-0.4, 0.4)
        
        # Call/Put OI: peak near ATM and decaying
        call_oi = int(max(100000, (6000000 * np.exp(-abs(offset - 1) / 2.0)) + np.random.uniform(-50000, 50000)))
        put_oi = int(max(100000, (6000000 * np.exp(-abs(offset + 1) / 2.0)) + np.random.uniform(-50000, 50000)))
        
        chain.append({
            "strike": strike,
            "call_oi": call_oi,
            "call_ltp": round(call_ltp, 2),
            "call_iv": f"{call_iv:.1f}%",
            "put_iv": f"{put_iv:.1f}%",
            "put_ltp": round(put_ltp, 2),
            "put_oi": put_oi
        })
        
    return chain

def calculate_pcr_and_pain(chain: list) -> dict:
    """
    Calculates Put-Call Ratio (PCR) and Max Pain strike from the options chain.
    """
    total_call_oi = sum(item["call_oi"] for item in chain)
    total_put_oi = sum(item["put_oi"] for item in chain)
    
    pcr = total_put_oi / (total_call_oi + 1e-10)
    
    # Calculate Max Pain
    # Max Pain is the strike price where total loss to option buyers is minimized.
    min_loss = float('inf')
    max_pain_strike = None
    
    for test_item in chain:
        test_strike = test_item["strike"]
        total_loss = 0.0
        
        for item in chain:
            strike = item["strike"]
            # Call buyer loss if test_strike is above strike (in-the-money calls get exercised)
            if test_strike > strike:
                total_loss += item["call_oi"] * (test_strike - strike)
            # Put buyer loss if test_strike is below strike (in-the-money puts get exercised)
            elif test_strike < strike:
                total_loss += item["put_oi"] * (strike - test_strike)
                
        if total_loss < min_loss:
            min_loss = total_loss
            max_pain_strike = test_strike
            
    if max_pain_strike is None:
        max_pain_strike = chain[len(chain)//2]["strike"]
        
    return {
        "pcr": round(pcr, 2),
        "max_pain": max_pain_strike
    }
