package dev.creditlab.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestTraceFilter extends OncePerRequestFilter {
  @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
    String id=UUID.randomUUID().toString(); response.setHeader("X-Request-ID",id); long start=System.nanoTime();
    response.setHeader("Cache-Control","no-store");
    try { chain.doFilter(request,response); }
    finally { LoggerFactory.getLogger(RequestTraceFilter.class).info("request id={} method={} status={} durationMs={}",id,request.getMethod(),response.getStatus(),(System.nanoTime()-start)/1_000_000); }
  }
}
