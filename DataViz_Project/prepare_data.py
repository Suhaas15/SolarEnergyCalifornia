import pandas as pd
import json
from pathlib import Path

def prepare_solar_data():
    """Prepare solar installation data for LM Studio context."""
    
    try:
        # Load the CSV data
        solar_data = pd.read_csv('Cleaned_Solar_Data.csv')
        print(f"Loaded data with {len(solar_data)} rows")
        
        # Create context examples
        context_examples = []
        
        # Generate county-level summaries with exact counts
        county_stats = solar_data.groupby('County').agg({
            'Install Type': 'count',
            'Acres': 'mean',
            'Urban or Rural': lambda x: x.value_counts().to_dict()
        }).reset_index()
        
        county_stats = county_stats.rename(columns={'Install Type': 'total_installations'})
        
        # Add rank information
        county_stats['rank'] = county_stats['total_installations'].rank(ascending=False, method='min').astype(int)
        
        # Generate examples for each county
        for _, row in county_stats.iterrows():
            county = row['County']
            print(f"Processing {county}")
            
            summary = {
                'county': county,
                'total_installations': int(row['total_installations']),
                'rank': int(row['rank']),
                'average_size': float(row['Acres']),
                'urban_rural_split': row['Urban or Rural']
            }
            
            # Generate factual examples
            examples = [
                {
                    'query': f"How many solar installations are in {county} County?",
                    'response': f"{county} County has {summary['total_installations']} installations."
                },
                {
                    'query': f"What is the ranking of {county} County in terms of installations?",
                    'response': f"{county} County ranks #{summary['rank']} in California with {summary['total_installations']} installations."
                }
            ]
            
            context_examples.extend(examples)
        
        # Save context examples
        output_dir = Path('model')
        output_dir.mkdir(exist_ok=True)
        
        with open(output_dir / 'context_examples.json', 'w') as f:
            json.dump({
                'examples': context_examples,
                'county_stats': county_stats.to_dict('records')
            }, f, indent=2)
        
        print(f"Generated {len(context_examples)} context examples")
        return context_examples, county_stats.to_dict('records')
        
    except Exception as e:
        print(f"Error processing data: {str(e)}")
        raise

def generate_comparison_response(county, full_data, county_summary):
    """Generate a comparison response for a county."""
    try:
        # Calculate county rankings
        county_installations = full_data.groupby('County').size().sort_values(ascending=False)
        county_rank = county_installations.index.get_loc(county) + 1
        total_counties = len(county_installations)
        
        # Calculate size comparison
        overall_avg_size = full_data['Acres'].mean()
        size_comparison = "larger" if county_summary['average_size'] > overall_avg_size else "smaller"
        
        return f"""{county} ranks #{county_rank} out of {total_counties} counties in total installations. 
The average installation size is {size_comparison} than the regional average ({county_summary['average_size']:.1f} vs {overall_avg_size:.1f} acres). 
It has {county_summary['total_installations']} installations, with {max(county_summary['installation_types'].items(), key=lambda x: x[1])[0]} being the most common type."""
    
    except Exception as e:
        print(f"Error generating comparison for {county}: {str(e)}")
        return f"Unable to generate comparison for {county} due to an error."

def generate_pattern_response(county_data):
    """Generate a pattern analysis response."""
    try:
        patterns = []
        
        # Analyze installation types
        main_type = county_data['Install Type'].mode().iloc[0]
        type_percent = (county_data['Install Type'] == main_type).mean() * 100
        patterns.append(f"{main_type} installations make up {type_percent:.1f}% of all installations")
        
        # Analyze urban/rural split
        urban_pct = (county_data['Urban or Rural'] == 'Urban').mean() * 100
        patterns.append(f"{urban_pct:.1f}% of installations are in urban areas")
        
        # Analyze size patterns
        avg_size = county_data['Acres'].mean()
        size_pattern = "large-scale" if avg_size > 10 else "small-scale"
        patterns.append(f"Installations tend to be {size_pattern} (average {avg_size:.1f} acres)")
        
        return "Key patterns observed:\n- " + "\n- ".join(patterns)
    
    except Exception as e:
        print(f"Error generating patterns: {str(e)}")
        return "Unable to generate pattern analysis due to an error."

def generate_trend_response(data, stats):
    """Generate a trend analysis response."""
    try:
        trends = [
            f"Total of {stats['total_installations']} installations across {stats['counties']} counties",
            f"Most common installation type: {max(stats['installation_types'].items(), key=lambda x: x[1])[0]}",
            f"Average installation size: {stats['avg_installation_size']:.2f} acres",
            f"Urban/Rural distribution: {stats['urban_rural_total']}"
        ]
        
        return "Overall trends in the region:\n- " + "\n- ".join(trends)
    
    except Exception as e:
        print(f"Error generating trends: {str(e)}")
        return "Unable to generate trend analysis due to an error."

def generate_efficiency_response(data):
    """Generate an efficiency analysis response."""
    try:
        # Calculate basic efficiency metrics
        county_stats = data.groupby('County').agg({
            'Acres': ['count', 'mean']
        }).round(2)
        
        # Sort by installation count
        top_counties = county_stats.nlargest(3, ('Acres', 'count'))
        
        response = "Areas with most solar installations:\n"
        for county in top_counties.index:
            count = int(top_counties.loc[county, ('Acres', 'count')])
            avg_size = float(top_counties.loc[county, ('Acres', 'mean')])
            response += f"- {county}: {count} installations, averaging {avg_size:.1f} acres each\n"
        
        return response
    
    except Exception as e:
        print(f"Error generating efficiency analysis: {str(e)}")
        return "Unable to generate efficiency analysis due to an error."

if __name__ == '__main__':
    examples, stats = prepare_solar_data()
    print("Data preparation complete. Ready for LM Studio integration.") 