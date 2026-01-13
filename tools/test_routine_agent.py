from ai_agents.routine_agent import RoutineAgent
import json

def test_routine():
    print("Testing RoutineAgent...")
    # Initialize agent (will use Mock if no key or force mock if we want, but let's try default)
    agent = RoutineAgent()
    print(f"Backend: {agent.backend()}")
    
    # Test data
    level = "Intermedio"
    goal = "Hipertrofia"
    freq = "4 días"
    equip = "Gimnasio completo"
    
    # Run
    try:
        result = agent.run(level, goal, freq, equip)
        print("Result received:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # Verify schema basic keys
        assert "routineName" in result
        assert "sessions" in result
        print("Schema validation: PASS")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_routine()
