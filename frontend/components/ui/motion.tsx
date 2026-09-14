"use client";

import { ReactNode, useEffect, useRef, useState, Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

// Props shared by all motion wrappers
export interface MotionProps {
  children: ReactNode;
  className?: string;
  delay?: number; // ms
  duration?: number; // ms
}

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
}

function useIntersectionObserver(
  ref: React.RefObject<Element | null>,
  options: UseIntersectionObserverOptions = { threshold: 0.1, triggerOnce: true }
) {
  const { triggerOnce = true, ...observerInit } = options;
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIntersecting(true);
        if (triggerOnce) {
          observer.unobserve(target);
        }
      } else if (!triggerOnce) {
        setIntersecting(false);
      }
    }, observerInit);

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [ref, triggerOnce, observerInit.threshold, observerInit.root, observerInit.rootMargin]);

  return isIntersecting;
}

export function FadeIn({ children, className, delay = 0, duration = 500 }: MotionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(ref, { threshold: 0.1, triggerOnce: true });

  return (
    <div
      ref={ref}
      className={cn(
        "transition-opacity motion-reduce:transition-none motion-reduce:opacity-100",
        isIntersecting ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function SlideUp({ children, className, delay = 0, duration = 500 }: MotionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(ref, { threshold: 0.1, triggerOnce: true });

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        isIntersecting ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function ScaleIn({ children, className, delay = 0, duration = 500 }: MotionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(ref, { threshold: 0.1, triggerOnce: true });

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:scale-100",
        isIntersecting ? "opacity-100 scale-100" : "opacity-0 scale-95",
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

interface StaggerChildrenProps extends Omit<MotionProps, 'delay'> {
  staggerMs?: number;
  initialDelay?: number;
}

export function StaggerChildren({ children, className, staggerMs = 100, initialDelay = 0 }: StaggerChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(ref, { threshold: 0.1, triggerOnce: true });

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        
        // Pass a CSS variable for the animation delay if they have CSS transitions
        const childProps = (child.props as Record<string, any>) || {};
        const childStyle = childProps.style || {};
        const delay = initialDelay + index * staggerMs;
        
        return cloneElement(child as React.ReactElement<any>, {
          style: {
            ...childStyle,
            "--stagger-delay": `${delay}ms`,
            ...(isIntersecting ? { animationPlayState: 'running' } : { animationPlayState: 'paused' })
          },
          // If the child is one of our motion components, we could pass delay directly
          delay: delay,
        });
      })}
    </div>
  );
}
