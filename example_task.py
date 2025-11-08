"""
Example Task: Document Processing with MCP Code Execution
===========================================================

This demonstrates the token-efficient pattern for MCP interaction:
1. Load only needed tool definitions (progressive disclosure)
2. Process data in execution environment (context efficiency)
3. Pass only filtered results to Claude (token savings)

Traditional Approach (Token Heavy):
-----------------------------------
TOOL CALL: gdrive.get_document('abc123')
→ Returns 50,000 char transcript in context

TOOL CALL: salesforce.update_record(...)
→ Writes 50,000 chars again in tool parameters

Total: ~100k tokens through context window

Code Execution Approach (Token Efficient):
------------------------------------------
1. Read tool definitions from filesystem (~500 tokens)
2. Execute data processing in environment (0 context tokens)
3. Return only summary (~1k tokens)

Total: ~1,500 tokens (98.5% reduction)
"""

import asyncio
from pathlib import Path


# NOTE: This is a template showing the pattern.
# Claude will generate actual server wrappers when you ask it to:
# "Setup MCP server wrappers for Google Drive and Salesforce"

async def example_document_to_crm():
    """
    Example: Extract meeting notes from Google Drive and attach to CRM
    
    Traditional direct tool calling would pass the entire document through
    the context window twice. This code execution approach processes it
    in the execution environment.
    """
    
    # Import only the tools we need (loaded from filesystem on-demand)
    # from servers.google_drive import get_document
    # from servers.salesforce import update_record
    
    print("1. Fetching document from Google Drive...")
    # doc = await get_document(document_id='abc123')
    # Simulate for template
    doc = {
        'content': "MEETING NOTES\n" + "Discussion point..." * 1000,  # Large doc
        'title': 'Q4 Planning Meeting',
        'url': 'https://drive.google.com/...'
    }
    
    print(f"   ✓ Retrieved document: {len(doc['content'])} characters")
    
    # Process in execution environment - NOT through context window
    print("2. Extracting action items (in execution environment)...")
    lines = doc['content'].split('\n')
    action_items = [
        line for line in lines 
        if line.strip().startswith(('ACTION:', 'TODO:', 'FOLLOW-UP:'))
    ]
    
    # Create summary with only essential information
    summary = f"""
Meeting: {doc['title']}
Action Items: {len(action_items)}

{chr(10).join(action_items[:10])}  # First 10 items

Full transcript: {doc['url']}
"""
    
    print(f"   ✓ Extracted {len(action_items)} action items")
    print(f"   ✓ Summary size: {len(summary)} characters (vs {len(doc['content'])} original)")
    
    # Update CRM with processed summary (not full document)
    print("3. Updating Salesforce record...")
    # result = await update_record(
    #     object_type='Lead',
    #     record_id='00Q5f000001abcXYZ',
    #     data={
    #         'Notes': summary,
    #         'MeetingTranscriptUrl': doc['url']
    #     }
    # )
    
    print("   ✓ Lead updated with summary")
    
    # Token savings calculation
    original_tokens = len(doc['content']) // 4 * 2  # Through context twice
    new_tokens = len(summary) // 4
    savings = (1 - new_tokens / original_tokens) * 100
    
    print(f"\n📊 Token Efficiency:")
    print(f"   Traditional approach: ~{original_tokens:,} tokens")
    print(f"   Code execution approach: ~{new_tokens:,} tokens")
    print(f"   Savings: {savings:.1f}%")


async def example_batch_processing():
    """
    Example: Process large dataset with filtering and aggregation
    
    Shows how to work with large datasets efficiently by processing
    in the execution environment rather than through context.
    """
    
    print("\n" + "="*60)
    print("Example: Batch Data Processing")
    print("="*60 + "\n")
    
    # from servers.salesforce import query
    # from servers.google_sheets import update_sheet
    
    print("1. Querying all leads from Salesforce...")
    # leads = await query(soql='SELECT Id, Name, Status, Value FROM Lead')
    # Simulate
    leads = [
        {'Id': f'00Q{i:06d}', 'Name': f'Lead {i}', 'Status': 'New', 'Value': i*1000}
        for i in range(10000)
    ]
    
    print(f"   ✓ Retrieved {len(leads)} leads")
    
    # Filter in execution environment
    print("2. Filtering for high-value pending leads...")
    high_value_pending = [
        lead for lead in leads
        if lead['Status'] == 'New' and lead['Value'] > 5000000
    ]
    
    print(f"   ✓ Filtered to {len(high_value_pending)} high-value leads")
    
    # Aggregate metrics
    print("3. Computing aggregate metrics...")
    total_value = sum(lead['Value'] for lead in high_value_pending)
    avg_value = total_value / len(high_value_pending) if high_value_pending else 0
    
    metrics = {
        'total_leads': len(leads),
        'high_value_count': len(high_value_pending),
        'total_value': total_value,
        'average_value': avg_value
    }
    
    print(f"   ✓ Total value: ${metrics['total_value']:,}")
    print(f"   ✓ Average: ${metrics['average_value']:,.0f}")
    
    # Export filtered subset
    print("4. Exporting filtered leads to sheet...")
    # await update_sheet(
    #     sheet_id='xyz789',
    #     range='A1',
    #     values=[[lead['Name'], lead['Value']] for lead in high_value_pending]
    # )
    
    print("   ✓ Exported to Google Sheets")
    
    # Token comparison
    all_data_tokens = len(str(leads)) // 4
    filtered_tokens = len(str(high_value_pending)) // 4
    savings = (1 - filtered_tokens / all_data_tokens) * 100
    
    print(f"\n📊 Token Efficiency:")
    print(f"   Passing all leads through context: ~{all_data_tokens:,} tokens")
    print(f"   Passing filtered results: ~{filtered_tokens:,} tokens")
    print(f"   Reduction: {savings:.1f}%")


async def example_with_skills():
    """
    Example: Using saved skills for reusable patterns
    
    Shows how Claude can build a library of proven patterns over time.
    """
    
    print("\n" + "="*60)
    print("Example: Using Saved Skills")
    print("="*60 + "\n")
    
    # After Claude has developed and saved skills, tasks become simpler
    # from skills.extract_meeting_actions import extract_actions
    # from skills.filter_large_dataset import filter_large_dataset
    # from servers.google_drive import get_document
    
    print("1. Using skill: extract_meeting_actions")
    # doc = await get_document('meeting_notes_123')
    # actions = await extract_actions(doc['content'])
    actions = ['ACTION: Follow up with client', 'ACTION: Update proposal']
    print(f"   ✓ Extracted {len(actions)} actions using proven skill")
    
    print("2. Using skill: filter_large_dataset")
    # all_records = await crm.get_records()
    # pending = await filter_large_dataset(
    #     all_records,
    #     filter_key='status',
    #     filter_value='pending'
    # )
    print(f"   ✓ Filtered dataset using proven skill")
    
    print("\n💡 Skills enable:")
    print("   - Faster development (reuse proven code)")
    print("   - Better reliability (tested patterns)")
    print("   - Token efficiency (no need to explain pattern each time)")


async def main():
    """Run all examples"""
    print("MCP Code Execution Examples")
    print("=" * 60)
    print()
    print("These examples demonstrate token-efficient MCP interaction")
    print("by processing data in the execution environment.")
    print()
    
    await example_document_to_crm()
    await example_batch_processing()
    await example_with_skills()
    
    print("\n" + "="*60)
    print("Key Takeaways")
    print("="*60)
    print("""
1. Load tool definitions on-demand from filesystem (progressive disclosure)
2. Process data in execution environment (context efficiency)
3. Pass only filtered/summarized results to Claude (token savings)
4. Build reusable skills over time (faster iteration)
5. Typical savings: 95-99% token reduction on data-heavy tasks
""")


if __name__ == "__main__":
    asyncio.run(main())
